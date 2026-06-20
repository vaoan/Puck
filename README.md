<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/puck-banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/puck-banner-light.svg">
  <img alt="Puck — event-following & notification platform" src="assets/puck-banner-dark.svg" width="100%">
</picture>

<br><br>

[![CI](https://github.com/vaoan/Puck/actions/workflows/ci.yml/badge.svg)](https://github.com/vaoan/Puck/actions/workflows/ci.yml)
&nbsp;![Node](https://img.shields.io/badge/Node-24-0E7C73?style=flat-square)
&nbsp;![pnpm](https://img.shields.io/badge/pnpm-10-0E7C73?style=flat-square)
&nbsp;![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E7C73?style=flat-square)
&nbsp;![License](https://img.shields.io/badge/License-MIT-0E7C73?style=flat-square)

<br>

**Follow events. Get the ping that matters.**

Puck watches the things you care about and tells you the moment they change —
the event is about to start, it's delayed or canceled, the venue moved, the
schedule shifted, an organizer posted, or a ticket update landed. Alerts go out
over **Telegram** and **email** today, with Discord, SMS, push, and WhatsApp
designed to drop in later without touching the core.

<sub>Named after Puck, the small, quick inner moon of Uranus — a nimble alert sprite: fast, reliable, out of your way.</sub>

</div>

---

## What makes it tick

|                         |                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| 🛰️ **Multi-channel**    | Telegram & email today; a new channel is a class, not a rewrite.                                           |
| 🧱 **Outbox-durable**   | An event change and its fan-out job commit in one transaction — never lost, never phantom.                 |
| 🔁 **Idempotent**       | Every notification has a deterministic `dedupe_key` with a UNIQUE constraint. A change can't notify twice. |
| ♻️ **Durable retries**  | Failed sends back off and re-queue; permanent failures and exhausted attempts dead-letter for inspection.  |
| 🪶 **Zero extra infra** | The queue (`pgmq`) and scheduler (`pg_cron`) live inside Supabase Postgres. No Redis, no new bills.        |
| 🧭 **Hexagonal core**   | The domain depends on ports, not SDKs — so channels and the queue are swappable by design.                 |

> Sister project to **CandyStore** and **Janus**: it shares their toolchain DNA
> (pnpm + Turbo monorepo, strict TypeScript, the same lint/format/test
> discipline), but its runtime is a backend service rather than a Next.js frontend.

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

The dependency rule is one-directional: `core` defines interfaces; `db`,
`queue`, and `channels` implement them; `apps` wire them together. Nothing in
`core` imports a concrete SDK — which is what makes channels and the queue
swappable.

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

## Getting started

> Requires **Node 24** (see `.nvmrc`) and **pnpm 10**. The local stack needs the
> [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

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

<details>
<summary><b>Wiring up Telegram & email</b></summary>

<br>

**Telegram.** Talk to [@BotFather](https://t.me/BotFather) to create a bot and
get a token, then set `TELEGRAM_BOT_TOKEN`. For local dev keep
`TELEGRAM_MODE=polling` (no public URL needed). In production set
`TELEGRAM_MODE=webhook` and a long random `TELEGRAM_WEBHOOK_SECRET`.

**Email.** Defaults to `EMAIL_PROVIDER=console`, which logs instead of sending —
the whole pipeline runs end-to-end with zero credentials. Switch to `resend`
(set `RESEND_API_KEY`) when you want real email.

</details>

<details>
<summary><b>Scripts</b></summary>

<br>

| Command                                   | What it does                            |
| ----------------------------------------- | --------------------------------------- |
| `pnpm dev`                                | Run all apps via Turbo                  |
| `pnpm build`                              | Type-checked build of every package/app |
| `pnpm typecheck`                          | `tsc --noEmit` across the workspace     |
| `pnpm test`                               | Run Vitest suites                       |
| `pnpm lint` / `pnpm format`               | ESLint / Prettier                       |
| `pnpm db:start` / `db:reset` / `db:types` | Local Supabase lifecycle                |

</details>

<details>
<summary><b>Adding a new channel</b></summary>

<br>

1. Implement `NotificationChannel` (from `@puck/core`) in
   `packages/channels/src/<channel>/`.
2. Add the channel key to `CHANNEL_KEYS` in `@puck/core` and the `channel_key`
   enum in a migration.
3. Register it in `buildChannelRegistry`.

No changes to `core`, the worker, or the queue are required.

</details>

## Why it's fail-safe & cheap

- **Outbox pattern** — an event change and its fan-out job are written in the
  same DB transaction, so a notification can never be lost or phantom-created.
- **Idempotent everywhere** — every notification has a deterministic
  `dedupe_key` with a UNIQUE constraint; re-processing a change can never
  deliver twice.
- **Durable retries** — failed deliveries stay queued (pgmq visibility timeout)
  and back off; permanent failures and exhausted attempts are dead-lettered.
- **No extra infrastructure** — the queue (`pgmq`) and scheduler (`pg_cron`)
  live inside the Supabase Postgres you already run.

## License

[MIT](LICENSE) © Heiner Angarita
