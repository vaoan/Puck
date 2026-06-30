#!/usr/bin/env node
/**
 * watcher.mjs — in-process health watcher
 *
 * Runs via supervisord inside the prod container.
 * Pings each service's health endpoint at a random 5–10 minute interval.
 * Also monitors system resources (RAM, disk).
 * Detects up→down and down→up transitions and (optionally) alerts via Telegram.
 *
 * Runtime shape: Puck runs Node long-running services (Fastify API + worker +
 * Telegram bot) PLUS a Next.js web app. Update APPS below when services land.
 *
 * Telegram env vars (set in compose.yml or the server env):
 *   TELEGRAM_BOT_TOKEN  — bot token from @BotFather
 *   TELEGRAM_CHAT_ID    — chat or group ID to send alerts to
 *   TELEGRAM_THREAD_ID  — (optional) forum topic thread ID for supergroups
 *
 * Tuning (optional):
 *   WATCHER_MIN_MS  — minimum interval in ms  (default: 300_000 = 5 min)
 *   WATCHER_MAX_MS  — maximum interval in ms  (default: 600_000 = 10 min)
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";

// ── Configuration ─────────────────────────────────────────────────────────────

const MIN_MS = Number(process.env.WATCHER_MIN_MS ?? 300_000);
const MAX_MS = Number(process.env.WATCHER_MAX_MS ?? 600_000);
const TIMEOUT_MS = 8_000;
const STARTUP_GRACE_MS = 90_000; // wait before first check so services can boot

// Re-alert on a persistent problem at most once per 2 hours
const REPEAT_ALERT_MS = 2 * 60 * 60 * 1_000;

// System resource thresholds
const RAM_CRITICAL_PCT = 2; // alert only when free RAM drops below 2% of total
const DISK_CRITICAL_PCT = 90;
const DISK_WARN_PCT = 80;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID ?? "";
const TELEGRAM_THREAD = process.env.TELEGRAM_THREAD_ID ?? "";
const TELEGRAM_CRITICAL_THREAD =
  process.env.TELEGRAM_CRITICAL_THREAD_ID ?? TELEGRAM_THREAD;
const CONTAINER_NAME = process.env.CONTAINER_NAME ?? "puck-prod";

function htmlEscape(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TELEGRAM_SOURCE = htmlEscape(process.env.SERVER_HOSTNAME || hostname());

// When WATCHER_NGINX_PORT is set (host watcher), check via the nginx reverse
// proxy so alerts reflect the real traffic path. Without it (Docker-internal
// watcher), check direct ports so supervisord failures are caught before nginx.
const NGINX_PORT = process.env.WATCHER_NGINX_PORT ?? null;

// fill per app when it lands — add entries for each HTTP-serving service:
//   { name: "web",  directUrl: "http://127.0.0.1:5000/health", nginxPath: "/health" }
//   { name: "api",  directUrl: "http://127.0.0.1:5001/health", nginxPath: "/api/health" }
// Worker and bot are not HTTP servers — monitor them via process checks instead.
const APPS = [
  // { name: "web",  directUrl: "http://127.0.0.1:5000/health", nginxPath: "/health"     },
  // { name: "api",  directUrl: "http://127.0.0.1:5001/health", nginxPath: "/api/health" },
].map(({ name, directUrl, nginxPath }) => ({
  name,
  url: NGINX_PORT ? `http://127.0.0.1:${NGINX_PORT}${nginxPath}` : directUrl,
}));

// Warm-up routes — only used when checking via nginx (the real traffic path).
const WARM_ROUTES = NGINX_PORT
  ? [
      // fill per app when it lands:
      // "/",
    ].map((path) => `http://127.0.0.1:${NGINX_PORT}${path}`)
  : [];

// ── State tracking ────────────────────────────────────────────────────────────

// Possible values: "unknown" | "up" | "down"
const state = Object.fromEntries(APPS.map((a) => [a.name, "unknown"]));

// System state: "unknown" | "ok" | "warning" | "critical"
const sysState = { ram: "unknown", disk: "unknown" };

// Cooldown map: key → timestamp of last alert sent for that key
const lastAlerted = new Map();

// ── Telegram ──────────────────────────────────────────────────────────────────

async function sendTelegramTo(text, threadId) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT,
          text: `${text}\n\n📍 ${TELEGRAM_SOURCE}`,
          parse_mode: "HTML",
          ...(threadId ? { message_thread_id: Number(threadId) } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[watcher] telegram error ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error(`[watcher] telegram send failed: ${err.message}`);
  }
}

// Regular channel — deploy steps, recoveries, info
async function sendTelegram(text) {
  return sendTelegramTo(text, TELEGRAM_THREAD || null);
}

// Critical channel — DOWN alerts, resource warnings, failures
async function sendTelegramCritical(text) {
  return sendTelegramTo(
    text,
    TELEGRAM_CRITICAL_THREAD || TELEGRAM_THREAD || null,
  );
}

/**
 * Alert on transition OR repeat a persistent alert after the cooldown window.
 * @param {string} key    — unique identifier for the alert category
 * @param {boolean} isNew — true if this is a new transition (prev state was ok/unknown)
 * @param {string} text   — HTML message to send
 */
async function maybeAlert(key, isNew, text) {
  const now = Date.now();
  if (isNew) {
    lastAlerted.set(key, now);
    await sendTelegramCritical(text);
    return;
  }
  // Persistent problem — re-alert only after cooldown
  const last = lastAlerted.get(key) ?? 0;
  if (now - last >= REPEAT_ALERT_MS) {
    lastAlerted.set(key, now);
    await sendTelegramCritical(text);
  }
}

// ── System health checks ──────────────────────────────────────────────────────

/** Returns { freeMB, totalMB } from /proc/meminfo, or null if unavailable. */
function readRamInfo() {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const total = meminfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
    const avail = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
    if (total && avail) {
      return {
        totalMB: Number(total[1]) / 1024,
        freeMB: Number(avail[1]) / 1024,
      };
    }
    // Fallback: MemFree (less accurate — doesn't include reclaimable cache)
    const free = meminfo.match(/^MemFree:\s+(\d+)\s+kB/m);
    if (total && free) {
      return {
        totalMB: Number(total[1]) / 1024,
        freeMB: Number(free[1]) / 1024,
      };
    }
  } catch {
    // not Linux or no /proc — ignore
  }
  return null;
}

function readDiskUsedPct() {
  try {
    const result = spawnSync("df", ["-P", "/"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    if (result.status !== 0) return null;
    // Output: Filesystem  1024-blocks  Used  Available  Capacity%  Mounted
    const lines = result.stdout.trim().split("\n");
    const data = lines[1];
    const match = data?.match(/(\d+)%/);
    if (match) return Number(match[1]);
  } catch {
    // df not available
  }
  return null;
}

async function checkSystem() {
  // ── RAM ──
  const ramInfo = readRamInfo();
  if (ramInfo !== null) {
    const { freeMB, totalMB } = ramInfo;
    const freePct = (freeMB / totalMB) * 100;
    const prev = sysState.ram;
    const next = freePct < RAM_CRITICAL_PCT ? "critical" : "ok";

    if (next === "critical") {
      const msg = `🔴 <b>RAM CRITICAL</b>\nAvailable: <code>${freeMB.toFixed(0)} MB</code> (<code>${freePct.toFixed(1)}%</code> of <code>${totalMB.toFixed(0)} MB</code>)  •  <code>${CONTAINER_NAME}</code>`;
      await maybeAlert("ram", prev !== "critical", msg);
      console.error(
        `[watcher] RAM critical: ${freeMB.toFixed(0)} MB (${freePct.toFixed(1)}%) of ${totalMB.toFixed(0)} MB`,
      );
    } else if (prev === "critical") {
      await sendTelegram(
        `✅ <b>RAM recovered</b>\nAvailable: <code>${freeMB.toFixed(0)} MB</code> (<code>${freePct.toFixed(1)}%</code>)  •  <code>${CONTAINER_NAME}</code>`,
      );
      console.log(
        `[watcher] RAM recovered: ${freeMB.toFixed(0)} MB (${freePct.toFixed(1)}%)`,
      );
    } else {
      console.log(
        `[watcher] RAM ok: ${freeMB.toFixed(0)} MB (${freePct.toFixed(1)}% of ${totalMB.toFixed(0)} MB)`,
      );
    }
    sysState.ram = next;
  }

  // ── Disk ──
  const diskPct = readDiskUsedPct();
  if (diskPct !== null) {
    const prev = sysState.disk;
    let next;
    if (diskPct >= DISK_CRITICAL_PCT) next = "critical";
    else if (diskPct >= DISK_WARN_PCT) next = "warning";
    else next = "ok";

    if (next !== "ok") {
      const icon = next === "critical" ? "🔴" : "🟡";
      const severity = next === "critical" ? "CRITICAL" : "warning";
      const msg = `${icon} <b>Disk ${severity}</b>\nUsed: <code>${diskPct}%</code> of root filesystem  •  <code>${CONTAINER_NAME}</code>`;
      await maybeAlert("disk", prev === "ok" || prev === "unknown", msg);
      console.error(`[watcher] Disk ${next}: ${diskPct}% used`);
    } else if (prev === "warning" || prev === "critical") {
      await sendTelegram(
        `✅ <b>Disk recovered</b>\nUsed: <code>${diskPct}%</code>  •  <code>${CONTAINER_NAME}</code>`,
      );
      console.log(`[watcher] Disk recovered: ${diskPct}%`);
    } else {
      console.log(`[watcher] Disk ok: ${diskPct}%`);
    }
    sysState.disk = next;
  }
}

// ── V8 warm-up ────────────────────────────────────────────────────────────────

async function warmUp() {
  if (WARM_ROUTES.length === 0) return;
  const start = Date.now();
  const results = await Promise.allSettled(
    WARM_ROUTES.map((url) =>
      fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "manual",
      }).then((res) => {
        if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      }),
    ),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  const dur = ((Date.now() - start) / 1000).toFixed(1);
  if (failed > 0) {
    console.warn(
      `[watcher] warm-up: ${failed}/${WARM_ROUTES.length} routes failed in ${dur}s`,
    );
  } else {
    console.log(
      `[watcher] warm-up: all ${WARM_ROUTES.length} routes ok in ${dur}s`,
    );
  }
}

// ── Ping one app ──────────────────────────────────────────────────────────────

async function ping(app) {
  const prev = state[app.name];

  try {
    // redirect: 'manual' prevents fetch from following redirects into 404s.
    // We only care that the service responds (any 1xx/2xx/3xx = alive);
    // 4xx/5xx mean the service is broken.
    const res = await fetch(app.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });

    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

    if (prev === "down") {
      console.log(`[watcher] ${app.name}: ✓ recovered`);
      state[app.name] = "up";
      await sendTelegram(
        `✅ <b>${app.name}</b> is back up  •  <code>${CONTAINER_NAME}</code>`,
      );
    } else {
      console.log(`[watcher] ${app.name}: ok`);
      state[app.name] = "up";
    }
  } catch (err) {
    state[app.name] = "down";

    if (prev === "up") {
      console.error(`[watcher] ${app.name}: ✗ DOWN — ${err.message}`);
      await sendTelegramCritical(
        `🔴 <b>${app.name}</b> is not responding\n<code>${err.message}</code>  •  <code>${CONTAINER_NAME}</code>`,
      );
    } else if (prev === "unknown") {
      console.error(
        `[watcher] ${app.name}: ✗ unreachable on first check — ${err.message}`,
      );
    } else {
      console.error(`[watcher] ${app.name}: ✗ still down — ${err.message}`);
    }
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

function randomInterval() {
  return MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS));
}

async function tick() {
  const ts = new Date().toISOString();
  console.log(`[watcher] checking all services and system at ${ts}`);

  await Promise.all(APPS.map(ping));
  await checkSystem();
  await warmUp();

  const next = randomInterval();
  console.log(`[watcher] next check in ${Math.round(next / 60_000)} min`);
  setTimeout(tick, next);
}

// Allow services to finish booting before the first check
console.log(
  `[watcher] started — first check in ${STARTUP_GRACE_MS / 1000}s ` +
    `(telegram: ${TELEGRAM_TOKEN ? `enabled, thread: ${TELEGRAM_THREAD || "none"}` : "disabled"})`,
);
setTimeout(tick, STARTUP_GRACE_MS);
