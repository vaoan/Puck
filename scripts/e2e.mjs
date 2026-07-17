#!/usr/bin/env node
/**
 * E2E orchestrator — stands up Supabase + the app per the loaded env file,
 * then runs the apps/web Playwright suite against it.
 *
 * Modes come from the env file (like scripts/supabase-docker.mjs):
 *   SUPABASE_MODE=docker → start a local Supabase stack (Supabase CLI)
 *   APPS_MODE=docker     → run the built container image (docker compose)
 *   APPS_MODE=local      → run `pnpm --filter web dev`
 *
 * Usage:
 *   node scripts/e2e.mjs --env <name> [--app web] [--headed] [--ui] [-- <pw args>]
 */
import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { get as httpGet } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEnv } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : fallback;
};
const targetEnv = flagValue("--env", "dev");
const targetApp = flagValue("--app", "web");
const headed = argv.includes("--headed");
const ui = argv.includes("--ui");
const ddIdx = argv.indexOf("--");
const passthrough = ddIdx !== -1 ? argv.slice(ddIdx + 1) : [];

if (targetApp !== "web") {
  console.error(`Only --app web is supported (got "${targetApp}").`);
  process.exit(1);
}

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnv(env) {
  const envPath = resolve(rootDir, `.env.${env}`);
  if (!existsSync(envPath)) throw new Error(`Env file not found: .env.${env}`);
  const secretsPath = resolve(rootDir, ".secrets");
  const secrets = existsSync(secretsPath)
    ? resolveEnv(readFileSync(secretsPath, "utf-8"), {})
    : {};
  const resolved = resolveEnv(readFileSync(envPath, "utf-8"), secrets);
  for (const [k, v] of Object.entries(resolved)) {
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(targetEnv);

const supabaseMode = process.env.SUPABASE_MODE ?? "cloud";
const appsMode = process.env.APPS_MODE ?? "local";
const hostPort = Number.parseInt(process.env.HOST_PORT ?? "5050", 10);
const imageName = process.env.PUCK_PROD_IMAGE_NAME ?? "puck-ci";
const DEV_PORT = 5000;

// ── helpers ───────────────────────────────────────────────────────────────────
function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: isWindows,
  });
}
function checkPort(port) {
  return new Promise((res) => {
    const s = createConnection({ host: "127.0.0.1", port }, () => {
      s.end();
      res(true);
    });
    s.on("error", () => res(false));
  });
}
function checkHttp(url) {
  return new Promise((res) => {
    const req = httpGet(url, (r) => {
      r.resume();
      res(true);
    });
    req.on("error", () => res(false));
    req.setTimeout(3000, () => {
      req.destroy();
      res(false);
    });
  });
}
async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkHttp(url)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`Timed out waiting for ${url}`);
  process.exit(1);
}

// ── 1. Supabase ─────────────────────────────────────────────────────────────
if (supabaseMode === "docker") {
  const r = run("node", [
    "scripts/supabase-docker.mjs",
    "start",
    "--env",
    targetEnv,
  ]);
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  console.log("Using non-docker Supabase — skipping local start.");
}

// ── 2. App ───────────────────────────────────────────────────────────────────
let devProc = null;
if (appsMode === "docker") {
  if (!(await checkPort(hostPort))) {
    const imageExists =
      spawnSync("docker", ["image", "inspect", imageName], { stdio: "ignore" })
        .status === 0;
    if (imageExists) {
      const r = run("docker", [
        "compose",
        "-f",
        "docker/compose.yml",
        "up",
        "-d",
        "--remove-orphans",
      ]);
      if (r.status !== 0) process.exit(r.status ?? 1);
    } else {
      const r = run("node", [
        "scripts/docker-build.mjs",
        "--env",
        targetEnv,
        "--up",
      ]);
      if (r.status !== 0) process.exit(r.status ?? 1);
    }
    await waitForHttp(`http://127.0.0.1:${hostPort}/`, 120_000);
  }
} else {
  if (!(await checkPort(DEV_PORT))) {
    devProc = spawn(pnpm, ["--filter", "web", "dev"], {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      shell: isWindows,
    });
    process.on("exit", () => {
      try {
        devProc?.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    });
    await waitForHttp(`http://127.0.0.1:${DEV_PORT}/en/login`, 120_000);
  }
}

// ── 3. Playwright ────────────────────────────────────────────────────────────
const pwArgs = [
  "--filter",
  "web",
  "exec",
  "playwright",
  "test",
  "--max-failures=1",
];
if (headed) pwArgs.push("--headed");
if (ui) pwArgs.push("--ui");
if (passthrough.length) pwArgs.push(...passthrough);

const pw = spawn(pnpm, pwArgs, {
  cwd: rootDir,
  stdio: "inherit",
  env: { ...process.env, TARGET_ENV: targetEnv },
  shell: isWindows,
});
pw.on("exit", (code) => {
  if (devProc) devProc.kill("SIGTERM");
  process.exit(code ?? 1);
});
