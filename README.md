# Puck 🛰️

> A fast, lightweight event-following and notification platform.

**Puck** lets users follow events and get notified the moment something
important changes — the event is about to start, it's delayed or canceled, the
location moved, the schedule shifted, an organizer posted an announcement, or a
ticket/check-in update landed. Notifications go out over **Telegram** and
**email** today, with more channels (Discord, SMS, push, WhatsApp) designed to
drop in later without touching the core.

Named after Puck, the smallest-but-quick inner moon of Uranus — Puck is meant
to feel like a nimble little alert sprite: fast, reliable, and out of your way.

It is a sister project to **CandyStore** and **Janus** and shares their
toolchain DNA (pnpm + Turbo monorepo, strict TypeScript, the same lint/format/
test discipline), but its runtime is a backend service rather than a Next.js
frontend.

---

## Architecture at a glance

```
                    ┌──────────────────────────────────────────────┐
   organizer /      │  apps/api  (Fastify)                          │
   upstream  ──────▶│   POST /internal/event-changes                │
   (Janus)          │   POST /follows · /telegram/webhook · /health │
                    └───────────────┬──────────────────────────────┘
                                    │ insert event_change
                                    ▼
              ┌─────────────────────────────────────────────┐
              │  Supabase Postgres                           │
              │   events · event_changes (outbox) · follows  │
              │   channel_subscriptions · notifications      │
              │   pgmq queues + pg_cron scheduler            │
              └───────┬───────────────────────────┬──────────┘
       trigger enqueues│ (same txn)                │ pg_cron inserts
       fan-out job     ▼                           │ "starting_soon"
              ┌────────────────────┐               │ changes on a timer
              │ apps/worker        │◀──────────────┘
              │  drain puck_fanout │  → expand into per-follower notifications
              │  drain puck_notifs │  → deliver via channel registry
              └─────────┬──────────┘
                        ▼
              ┌────────────────────┐
              │ @puck/channels     │  swappable providers
              │  telegram (grammY) │
              │  email (resend/…)  │
              └────────────────────┘
```

### Why it's fail-safe & cheap

- **Outbox pattern** — an event change and its fan-out job are written in the
  same DB transaction, so a notification can never be lost or phantom-created.
- **Idempotent everywhere** — every notification has a deterministic
  `dedupe_key` with a UNIQUE constraint; re-processing a change can never
  deliver twice.
- **Durable retries** — failed deliveries stay queued (pgmq visibility
  timeout) and back off; permanent failures and exhausted attempts are
  dead-lettered for inspection.
- **No extra infrastructure** — the queue (`pgmq`) and scheduler (`pg_cron`)
  live inside the Supabase Postgres you already run. No Redis, no new bills.

## Repository layout

```
apps/
  api/        Fastify HTTP service — intake (webhooks, follows, event changes)
  worker/     long-running queue consumer — fan-out + delivery
packages/
  config/     zod-validated environment loading
  core/       domain model, ports (interfaces), and pure services
  db/         Supabase client + repository implementations
  queue/      pgmq-backed Queue implementation
  channels/   channel registry + Telegram & Email adapters
supabase/
  migrations/ schema, queues, outbox trigger, RLS, pg_cron job
```

The dependency rule is one-directional: `core` defines interfaces; `db`,
`queue`, and `channels` implement them; `apps` wire them together. Nothing in
`core` imports a concrete SDK, which is what makes channels and the queue
swappable.

## Getting started

> Requires **Node 24** (see `.nvmrc`) and **pnpm 10**. The local stack needs
> the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```bash
# 1. install
pnpm install

# 2. configure — copy the template and fill in local values
cp .env.example .env

# 3. bring up the local Supabase stack (Postgres + pgmq + pg_cron + Auth)
pnpm db:start
pnpm db:reset          # applies supabase/migrations
pnpm db:types          # regenerate packages/db/src/database.types.ts

# 4. run the services (in separate terminals, or via turbo)
pnpm --filter @puck/api dev
pnpm --filter @puck/worker dev
```

> ⚠️ **Puck uses its own Supabase project.** Never point `SUPABASE_URL` /
> `SUPABASE_SERVICE_ROLE_KEY` at CandyStore or any shared/production database.

### Telegram

Talk to [@BotFather](https://t.me/BotFather) to create a bot and get a token.
Set `TELEGRAM_BOT_TOKEN`. For local dev keep `TELEGRAM_MODE=polling` (no public
URL needed). In production set `TELEGRAM_MODE=webhook` and a long random
`TELEGRAM_WEBHOOK_SECRET`.

### Email

Defaults to `EMAIL_PROVIDER=console`, which logs instead of sending — the whole
pipeline runs end-to-end with zero credentials. Switch to `resend` (set
`RESEND_API_KEY`) when you want real email.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps via Turbo |
| `pnpm build` | Type-checked build of every package/app |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Run Vitest suites |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm db:start` / `db:reset` / `db:types` | Local Supabase lifecycle |

## Adding a new channel

1. Implement `NotificationChannel` (from `@puck/core`) in
   `packages/channels/src/<channel>/`.
2. Add the channel key to `CHANNEL_KEYS` in `@puck/core` and the
   `channel_key` enum in a migration.
3. Register it in `buildChannelRegistry`.

No changes to `core`, the worker, or the queue are required.

## License

UNLICENSED / private (for now).
