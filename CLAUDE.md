# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

**Puck** is a fast, lightweight event-following and notification platform.
Users follow events and receive notifications (Telegram, email, and more later)
when something important changes — start/delay/cancel, location or schedule
changes, organizer announcements, ticket/check-in updates, and other meaningful
status changes. See `README.md` for the architecture overview.

## References

**Sister projects: `Z:\Github\candystore` and `Z:\Github\Janus`.** Puck shares
their _toolchain and conventions_ — pnpm + Turbo monorepo, strict TypeScript,
ESLint (flat config) + Prettier, Vitest, Husky, secretlint/cspell, the
`.env` + `.secrets` discipline, kebab-case filenames, and CI/CD style. Consult
them for tooling decisions and follow the same approach unless noted below.

**Puck deliberately diverges from the sisters in _runtime architecture_:** it is
a backend service (Fastify API + Node worker + Supabase), not a Next.js
frontend. Do **not** copy in Next.js/React/shadcn/Orval setup.

> ⚠️ **CandyStore is in production. Never run anything against its database.**
> Puck has its own separate Supabase project. Never put CandyStore credentials
> in Puck's `.env`/`.secrets`, and never point `SUPABASE_URL` at it.

## Architecture rules

- **Clean / hexagonal layering.** `@puck/core` owns the domain model and
  **ports** (interfaces). `@puck/db`, `@puck/queue`, `@puck/channels` are
  **adapters** implementing those ports. `apps/*` wire adapters to ports.
  Dependencies point inward — `core` imports no concrete SDK.
- **Channels are swappable.** A new channel (Discord, SMS, push, WhatsApp) is
  added by implementing `NotificationChannel` and registering it — never by
  editing core or the worker. See the README's "Adding a new channel".
- **The queue is swappable too.** The default is `pgmq` (in Supabase Postgres,
  zero extra infra). Anything depending on a queue uses the `Queue` port.
- **Idempotency is sacred.** Every notification has a deterministic
  `dedupe_key` (`eventChangeId:subscriptionId:channel`) with a UNIQUE
  constraint. Never weaken this — it is the no-duplicate-sends guarantee.
- **Outbox pattern.** Event changes are persisted; a DB trigger enqueues
  fan-out in the same transaction. Don't fan out synchronously in request
  handlers.
- **Fail-safe over fast.** Prefer "retry later" to "drop". Classify channel
  errors as permanent vs transient so retries behave; dead-letter the rest.

## Conventions

- **Package manager:** pnpm 10. Workspaces: `apps/*`, `packages/*`. Internal
  deps use `workspace:*` and the `@puck/<name>` scope.
- **Language:** TypeScript strict, ESM (`"type": "module"`), `NodeNext`
  resolution. Import local files with the `.js` extension in specifiers.
- **Filenames:** kebab-case (enforced by `unicorn/filename-case` + ls-lint).
- **Validation:** zod at every boundary (env, HTTP bodies, queue payloads).
- **No secrets in code.** Real values live in `.secrets` / CI secrets, never in
  git. `secretlint` runs pre-commit.
- **Tests:** Vitest, colocated as `*.test.ts`. Core domain logic is tested with
  in-memory fakes (no DB needed) — keep it that way; it's the fast safety net.

## Commands

```bash
pnpm install            # install workspace deps
pnpm dev                # run all apps (turbo)
pnpm typecheck          # tsc --noEmit across workspace
pnpm test               # vitest
pnpm lint / pnpm format # eslint / prettier
pnpm db:start           # local Supabase (Postgres + pgmq + pg_cron)
pnpm db:reset           # apply supabase/migrations
pnpm db:types           # regenerate packages/db/src/database.types.ts
```

Run a single package: `pnpm --filter @puck/core test`.

## Definition of done for a change

1. `pnpm typecheck` clean.
2. `pnpm test` green (add/adjust tests for new logic).
3. `pnpm lint` and `pnpm format:check` clean.
4. New env vars added to `.env.example`, validated in `@puck/config`, and
   documented in the README.
5. Schema changes are a new `supabase/migrations/*.sql` file (never edit an
   applied migration), and `pnpm db:types` is re-run.
