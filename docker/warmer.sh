#!/bin/sh
# warmer.sh — Warm-up loop to prevent cold starts inside the prod container.
# Runs as a supervisord program; fires immediately on startup (after services
# are ready), then every 12 minutes.
#
# Runtime shape: Puck runs Node long-running services (Fastify API + worker +
# Telegram bot) PLUS a Next.js web app. Only HTTP-serving apps need warming.
# fill per app when it lands — update APPS below.

set -eu

INTERVAL=720  # 12 minutes

# port:path pairs — one representative route per HTTP app
# fill per app when it lands:
#   5000:/     → apps/web (Next.js)
#   5001:/health → apps/api (Fastify — health endpoint)
APPS="
5000:/
"

log() { printf '[WARMER] %s %s\n' "$(date -u '+%H:%M:%S')" "$*"; }

# Wait until every app's TCP port accepts connections
log "Waiting for all services to be ready..."
for entry in $APPS; do
  port="${entry%%:*}"
  until nc -z 127.0.0.1 "$port" 2>/dev/null; do sleep 2; done
  log "  port ${port} ready"
done
log "All services ready — starting warm-up loop (every ${INTERVAL}s)."

warm() {
  for entry in $APPS; do
    port="${entry%%:*}"
    path="${entry#*:}"
    url="http://127.0.0.1:${port}${path}"
    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "ERR")
    log "  :${port}${path} → HTTP ${status}"
  done
}

while true; do
  log "--- warm-up start ---"
  warm
  log "--- warm-up done. next in ${INTERVAL}s ---"
  sleep "$INTERVAL"
done
