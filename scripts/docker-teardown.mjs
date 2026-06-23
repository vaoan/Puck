#!/usr/bin/env node
/**
 * Stops and removes a Puck Docker container and image for a given env.
 *
 * Usage:
 *   node scripts/docker-teardown.mjs [--env <name>] [--help]
 *
 *   --env <name>   Environment to load (default: prod)
 *   --help         Print this help and exit
 *
 * Examples:
 *   pnpm docker:teardown --env staging
 *   pnpm docker:teardown --env prod
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEnv } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// ── CLI arg parsing ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`
Usage: node scripts/docker-teardown.mjs [--env <name>] [--help]

  --env <name>   Environment to load from .env.<name> (default: prod)
  --help         Print this help and exit

What it does:
  1. Stops and removes the container (docker compose down)
  2. Removes the built image (docker rmi)

Examples:
  pnpm docker:teardown --env staging
  pnpm docker:teardown --env prod
`);
  process.exit(0);
}

const envFlag = args.indexOf("--env");
const targetEnv = envFlag !== -1 ? args[envFlag + 1] : "prod";

// ── Load env file ─────────────────────────────────────────────────────────────

function loadEnv(env) {
  const envPath = resolve(rootDir, `.env.${env}`);
  if (!existsSync(envPath)) {
    throw new Error(`Env file not found: .env.${env}`);
  }
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

try {
  loadEnv(targetEnv);
} catch (err) {
  console.error(`ERROR: Failed to load .env.${targetEnv}: ${err.message}`);
  process.exit(1);
}

const imageName = process.env.PUCK_PROD_IMAGE_NAME;
const containerName = process.env.PUCK_PROD_CONTAINER_NAME;

if (!imageName) {
  console.error("ERROR: PUCK_PROD_IMAGE_NAME is not set in the env file.");
  process.exit(1);
}

if (!containerName) {
  console.error("ERROR: PUCK_PROD_CONTAINER_NAME is not set in the env file.");
  process.exit(1);
}

console.log(`\ndocker-teardown`);
console.log(`   env:       ${targetEnv}`);
console.log(`   image:     ${imageName}`);
console.log(`   container: ${containerName}\n`);

// ── Step 1: docker compose down (stops + removes container) ──────────────────

console.log(`Stopping and removing container: ${containerName} ...`);

const downResult = spawnSync(
  "docker",
  ["compose", "-f", "docker/compose.yml", "down", "--remove-orphans"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      PUCK_PROD_IMAGE_NAME: imageName,
      PUCK_PROD_CONTAINER_NAME: containerName,
    },
  },
);

if (downResult.status !== 0) {
  // Non-zero here usually means the container wasn't running — not fatal.
  console.warn(
    `  docker compose down exited with ${downResult.status ?? "unknown"} (container may not have been running)`,
  );
}

// ── Step 2: docker rmi (removes the image) ────────────────────────────────────

console.log(`\nRemoving image: ${imageName} ...`);

const rmiResult = spawnSync("docker", ["rmi", imageName], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});

if (rmiResult.status !== 0) {
  // Non-zero here usually means the image didn't exist — not fatal.
  console.warn(
    `  docker rmi exited with ${rmiResult.status ?? "unknown"} (image may not exist)`,
  );
}

console.log(`\nTeardown complete for env: ${targetEnv}`);
process.exit(0);
