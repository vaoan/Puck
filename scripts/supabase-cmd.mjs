#!/usr/bin/env node
// Runs any supabase CLI command with env loaded.
// Usage: node scripts/supabase-cmd.mjs start | stop | db reset | ...
// Usage with env: node scripts/supabase-cmd.mjs --env staging start
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEnv } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const envFlag = process.argv.indexOf("--env");
const targetEnv = envFlag !== -1 ? process.argv[envFlag + 1] : "dev";

function loadEnv(env) {
  const envPath = resolve(rootDir, `.env.${env}`);
  if (!existsSync(envPath)) return;
  const envText = readFileSync(envPath, "utf-8");
  const secretsPath = resolve(rootDir, ".secrets");
  const secrets = existsSync(secretsPath)
    ? resolveEnv(readFileSync(secretsPath, "utf-8"), {})
    : {};
  const resolved = resolveEnv(envText, secrets);
  for (const [k, v] of Object.entries(resolved)) {
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(targetEnv);

// Strip --env <name> before forwarding args to supabase
const supabaseArgs = process.argv
  .slice(2)
  .filter((a, i, arr) => a !== "--env" && arr[i - 1] !== "--env");

const result = spawnSync(
  // nosemgrep: spawn-shell-true
  isWindows ? "pnpm.cmd" : "pnpm",
  ["supabase", ...supabaseArgs],
  { cwd: rootDir, stdio: "inherit", env: process.env, shell: isWindows },
);

process.exit(result.status ?? 0);
