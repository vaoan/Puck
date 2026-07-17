# =============================================================================
# Puck — CI / local-dev image (build from source)
# Builds apps/web in Next.js standalone mode, serves it behind nginx via
# supervisord on port 8080 for E2E / health testing.
#
# Build: docker build -f docker/ci/Dockerfile -t puck-ci .
# Run:   docker run -p 5050:8080 puck-ci
# =============================================================================

# ── Stage 1: install deps ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/

RUN pnpm install --frozen-lockfile || \
    (echo "Frozen lockfile install failed in Docker, retrying without frozen lockfile" && \
    pnpm install --no-frozen-lockfile)

COPY . .

# ── Build args baked into bundles at build time ───────────────────────────────
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_BUILD_HASH=ci
ARG NEXT_PUBLIC_ENABLE_TEST_IDS

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_BUILD_HASH=$NEXT_PUBLIC_BUILD_HASH
ENV NEXT_PUBLIC_ENABLE_TEST_IDS=$NEXT_PUBLIC_ENABLE_TEST_IDS
ENV STANDALONE=true

# ── Stage 2: build web ────────────────────────────────────────────────────────
FROM deps AS builder
RUN pnpm --filter web run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache nginx supervisor netcat-openbsd && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 puck && \
    mkdir -p /var/log/nginx /var/log/supervisor /var/run/nginx /run/nginx && \
    chown -R puck:nodejs /var/lib/nginx /var/log/nginx /var/log/supervisor /var/run/nginx /run/nginx

COPY docker/prod/nginx.conf /etc/nginx/nginx.conf
COPY docker/prod/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/watcher.mjs /app/watcher.mjs
COPY docker/warmer.sh /app/warmer.sh
COPY docker/boot-reporter.mjs /app/boot-reporter.mjs

# apps/web (Next.js standalone) — server entry at /app/web/apps/web/server.js
COPY --from=builder /app/apps/web/.next/standalone /app/web/
COPY --from=builder /app/apps/web/.next/static     /app/web/apps/web/.next/static
COPY --from=builder /app/apps/web/public           /app/web/apps/web/public

RUN chown -R puck:nodejs /app

EXPOSE 8080

USER puck
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
