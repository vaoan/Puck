#!/usr/bin/env bash
# docker-health-check.sh — builds the CI image, runs it on a random port,
# waits for /health, then cleans up.
# Used by: .husky/pre-push (when deploy files change).
#
# Runtime shape: Puck runs Node long-running services (Fastify API + worker +
# Telegram bot) PLUS a Next.js web app. The CI image build step below will
# build all apps. Update BUILD_ARG_KEYS when NEXT_PUBLIC_* vars are added.
#
# No-op safety: the script exits 0 if docker is not available (e.g. on a
# developer machine without Docker Desktop running).

set -euo pipefail

IMAGE_NAME="puck-health-check"
CONTAINER_NAME="puck-health-check-$$"

# No-op if docker is not available
if ! command -v docker >/dev/null 2>&1; then
  echo "[health-check] docker not found — skipping."
  exit 0
fi

cleanup() {
  if docker ps -aq -f "name=^${CONTAINER_NAME}$" | grep -q .; then
    echo "Cleaning up container $CONTAINER_NAME..."
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# ── Load env vars from .env.dev if not already set ────────────────────────────
# In CI, NEXT_PUBLIC_* vars are pre-set — skip the loader.
if [ -z "${CI:-}" ] && [ -f ".env.dev" ]; then
  echo "Loading env from .env.dev..."
  eval "$(node --input-type=module <<'EOF'
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEnv } from './scripts/load-env.mjs';
const rootDir = process.cwd();
const envText = readFileSync(resolve(rootDir, '.env.dev'), 'utf-8');
const secretsPath = resolve(rootDir, '.secrets');
const secrets = existsSync(secretsPath)
  ? resolveEnv(readFileSync(secretsPath, 'utf-8'), {})
  : {};
const resolved = resolveEnv(envText, secrets);
for (const [k, v] of Object.entries(resolved)) {
  if (k.startsWith('NEXT_PUBLIC_')) {
    process.stdout.write(`export ${k}=${JSON.stringify(v)}\n`);
  }
}
EOF
)"
fi

# ── 1. Build ──────────────────────────────────────────────────────────────────
# Build args are generated dynamically from the exported env vars.
# fill per app when it lands — add NEXT_PUBLIC_* keys for apps/web here:
BUILD_ARGS=$(node --input-type=module <<'EOF'
const keys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_WEB_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_BUILD_HASH',
  'NEXT_PUBLIC_ENABLE_TEST_IDS',
  'NEXT_PUBLIC_ENV_DEBUG',
];
for (const k of keys) {
  process.stdout.write(`--build-arg ${k}=${process.env[k] ?? ''}\n`);
}
EOF
)

# ── Windows: clean pnpm .ignored_* files before building ─────────────────────
# pnpm creates node_modules/.ignored_* with restricted NTFS permissions that
# prevent Docker Desktop's build context sender from enumerating them.
# These files are pnpm-internal markers; deleting them is safe.
find . -name ".ignored_*" -delete 2>/dev/null || true

echo "Building Docker image: $IMAGE_NAME..."
# shellcheck disable=SC2086
docker build \
  -t "$IMAGE_NAME" \
  -f docker/ci/Dockerfile \
  $BUILD_ARGS \
  . || { echo "ERROR: Docker build failed."; exit 1; }

# ── 2. Pick a random available port ───────────────────────────────────────────
PORT=$(node -e "
  const net = require('net');
  const s = net.createServer();
  s.listen(0, () => { process.stdout.write(String(s.address().port)); s.close(); });
")
echo "Using port $PORT for health check."

# ── 3. Run container ──────────────────────────────────────────────────────────
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${PORT}:8080" \
  "$IMAGE_NAME" >/dev/null

# ── 4. Wait for /health endpoint (max 60s) ────────────────────────────────────
echo "Waiting for /health endpoint..."
ELAPSED=0
until curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; do
  if [ "$ELAPSED" -ge 60 ]; then
    echo "ERROR: Container did not become healthy within 60s."
    docker logs "$CONTAINER_NAME"
    exit 1
  fi
  node -e "setTimeout(()=>{},2000)" 2>/dev/null || true
  ELAPSED=$((ELAPSED + 2))
done
echo "Container is healthy."

echo "Docker health check passed."
