# =============================================================================
# Puck — CI / local-dev image (build from source)
#
# Runtime shape: Puck runs Node long-running services (Fastify API + worker +
# Telegram bot) PLUS a Next.js web app (apps/web). This is NOT a pure
# nginx-served Next.js deployment — each service runs as its own process.
#
# This CI image builds apps/web in Next.js standalone mode and the Node
# services, then runs them behind nginx via supervisord.
# Exposes port 8080 (nginx) for E2E / health testing.
#
# Build: docker build -f docker/ci/Dockerfile -t puck-ci .
# Run:   docker run -p 8088:8080 puck-ci
# =============================================================================

# ── Stage 1: install deps ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# fill per app when it lands — copy each app/package package.json here:
# COPY apps/web/package.json ./apps/web/
# COPY apps/api/package.json ./apps/api/
# COPY apps/worker/package.json ./apps/worker/
# COPY apps/bot/package.json ./apps/bot/
# COPY packages/core/package.json ./packages/core/
# COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile || \
    (echo "Frozen lockfile install failed in Docker, retrying without frozen lockfile" && \
    pnpm install --no-frozen-lockfile)

COPY . .

# ── Build args baked into bundles at build time ───────────────────────────────
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BUILD_HASH=ci
ARG NEXT_PUBLIC_ENABLE_TEST_IDS
ARG NEXT_PUBLIC_ENV_DEBUG

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BUILD_HASH=$NEXT_PUBLIC_BUILD_HASH
ENV NEXT_PUBLIC_ENABLE_TEST_IDS=$NEXT_PUBLIC_ENABLE_TEST_IDS
ENV STANDALONE=true

# ── Stage 2: build each app ───────────────────────────────────────────────────
# fill per app when it lands — add pnpm build commands for each app:
# apps/web    → Next.js standalone build
# apps/api    → Node/Fastify build (tsc or esbuild)
# apps/worker → Node build
# apps/bot    → Node build
FROM deps AS builder
# PLACEHOLDER: pnpm --filter web run build
# PLACEHOLDER: pnpm --filter api run build
# PLACEHOLDER: pnpm --filter worker run build
# PLACEHOLDER: pnpm --filter bot run build
RUN echo "No apps to build yet — add build commands here when apps land"

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache nginx supervisor netcat-openbsd && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 puck && \
    mkdir -p /var/log/nginx /var/log/supervisor /var/run/nginx /run/nginx && \
    chown -R puck:nodejs /var/lib/nginx /var/log/nginx /var/log/supervisor /var/run/nginx /run/nginx

# Copy nginx and supervisord configs from prod (shared config)
COPY docker/prod/nginx.conf /etc/nginx/nginx.conf
COPY docker/prod/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy the in-container health watcher
COPY docker/watcher.mjs /app/watcher.mjs

# fill per app when it lands — copy each app's build output here:
#
# apps/web (Next.js standalone):
# COPY --from=builder /app/apps/web/.next/standalone  /app/web/
# COPY --from=builder /app/apps/web/.next/static      /app/web/apps/web/.next/static
# COPY --from=builder /app/apps/web/public            /app/web/apps/web/public
#
# apps/api (Node/Fastify — dist output):
# COPY --from=builder /app/apps/api/dist              /app/api/
#
# apps/worker (Node — dist output):
# COPY --from=builder /app/apps/worker/dist           /app/worker/
#
# apps/bot (Node — dist output):
# COPY --from=builder /app/apps/bot/dist              /app/bot/

RUN chown -R puck:nodejs /app

EXPOSE 8080

USER puck
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
