# =============================================================================
# Puck — Production runner (pre-built artifacts)
#
# Runtime shape: Puck runs Node long-running services (Fastify API + worker +
# Telegram bot) PLUS a Next.js web app (apps/web).
#   - apps/web    → Next.js standalone mode served by nginx (port 5000)
#   - apps/api    → Fastify API server (port 5001)
#   - apps/worker → Node notification worker (long-running)
#   - apps/bot    → Telegram consumer bot (long-running)
#
# Node services are managed by supervisord alongside nginx; they do NOT serve
# through nginx — each binds its own port or communicates via queue/DB.
#
# This Dockerfile copies pre-built artifacts that were built by CI and
# rsynced/deployed to the server. It never builds from source on the server.
#
# Build context: monorepo root (after CI has rsynced apps/*/.next/ and dist/)
# =============================================================================

# ── ARG: select which app/service to include (for single-app images) ─────────
# When building a combined all-services image, leave APP unset.
# To build a single-service image: --build-arg APP=api
ARG APP=all

FROM node:22-alpine AS runner

RUN apk add --no-cache nginx supervisor netcat-openbsd curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 puck && \
    mkdir -p /var/log/nginx /var/log/supervisor /var/run/nginx /run/nginx && \
    chown -R puck:nodejs /var/lib/nginx /var/log/nginx /var/log/supervisor /var/run/nginx /run/nginx

# Stable infrastructure config — placed BEFORE volatile app layers so these
# layers keep identical hashes across deploys and are cache-hit by both CI
# (--cache-from :latest) and the VM's local layer store.
COPY docker/prod/nginx.conf           /etc/nginx/nginx.conf
COPY docker/prod/supervisord.conf     /etc/supervisor/conf.d/supervisord.conf
COPY docker/watcher.mjs               /app/watcher.mjs
COPY docker/boot-reporter.mjs         /app/boot-reporter.mjs
COPY docker/warmer.sh                 /app/warmer.sh

# ── apps/web — Next.js standalone (served via nginx on port 5000) ─────────────
# fill per app when it lands:
# COPY apps/web/.next/standalone      /app/web/
# COPY apps/web/.next/static          /app/web/apps/web/.next/static
# COPY apps/web/public                /app/web/apps/web/public

# ── apps/api — Fastify API (Node long-running service, port 5001) ─────────────
# fill per app when it lands:
# COPY apps/api/dist                  /app/api/

# ── apps/worker — Notification worker (Node long-running service) ─────────────
# fill per app when it lands:
# COPY apps/worker/dist               /app/worker/

# ── apps/bot — Telegram consumer bot (Node long-running service) ──────────────
# fill per app when it lands:
# COPY apps/bot/dist                  /app/bot/

# Remove any pnpm workspace stub node_modules that shadow the standalone root
# node_modules/ — Node must resolve packages from the standalone root.
# fill per app when it lands:
# RUN rm -rf \
#     /app/web/apps/web/node_modules \
#     /app/api/node_modules \
#     /app/worker/node_modules \
#     /app/bot/node_modules

RUN chown -R puck:nodejs /app && \
    chmod +x /app/warmer.sh

EXPOSE 8080

USER puck
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
