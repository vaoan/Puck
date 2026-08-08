# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

**Puck** is a standalone, multi-tenant **event-scheduler + notification
platform**. Puck owns _everything_ about event scheduling — there is no upstream
feed; organizers author their own data inside Puck.

Organizers create umbrella **events** (multi-day festivals/conferences)
containing a flat schedule of **sessions** (each with a start time; sessions may
**recur**). Authoring is governed by a **Libra-style permission system**
(owners + delegates, not a single admin). End users discover events and
subscribe at two levels — to a **whole event** (a **daily digest** of that day's
schedule) and/or to **individual sessions** (reminders at configurable lead
times: 30 / 15 / 10 / 5 min before, and at start). Notifications go out over
**Telegram** and **email**, with more channels designed to drop in later.

See `README.md` for the product overview and `docs/2026-06-19-platform-roadmap.md`
for the decomposition.

## Current state — Foundation (#1) complete; web app (#2) in progress

> ⚠️ **Sub-projects 3–4 are not yet implemented.** The Foundation (#1) is done:
> all 12 DB migrations (identity, RBAC, domain, delegation, RLS, RPCs, audit),
> `packages/auth` (permission key catalog + `matchesPermissions` helper), and
> `packages/db` (generated Supabase types).
>
> **Sub-project #2 (`apps/web`) is in progress** — slice 1 (app shell + social
> auth + account), tracked by
> `docs/superpowers/plans/2026-06-30-puck-web-shell-auth.md` (13 tasks).
> **Merged to `develop` (tasks 1–8, PRs #6 + #7):** `packages/ui` (`@puck/ui` —
> Puck OKLCH design tokens + base shadcn components), the `apps/web` scaffold
> (Next.js 16 + vitest/RTL + `tid()`), Supabase browser/server clients + env
> config, next-intl i18n (`[locale]`, en/es), OAuth login page + callback route,
> middleware session refresh + `(app)` route protection, and the protected app
> shell (nav + providers). **All 13 slice-1 tasks are now done on branch
> `feat/GH-5_Account-Feature` (uncommitted):** the account feature (tasks 9–11 —
> domain + column-scoped profile queries, `useProfile`/`useUpdateProfile`,
> `ProfileForm` + `AccountPage` + `SignOutButton` + `/account`, all TDD), the
> Playwright E2E suite (task 12 — protected redirect, seeded-session account edit
> proving DB persistence, axe a11y), and the docs/DoD sweep (task 13). Full sweep
> is green: format, lint, typecheck, 30 unit tests, `next build`, 4 E2E.
>
> ⚠️ **The E2E caught several bugs in the merged shell/auth (tasks 5–8) that unit
> tests + CI missed** (CI has no build job): middleware was at the wrong path and
> wrong name for Next 16 → auth never ran (now `src/proxy.ts` exporting `proxy`);
> its `export const config = { matcher }` broke `next build` and hydration (assets
> 404'd at `/en/_next/*`) → fixed by filtering excluded paths inside `proxy()`;
> bare `/` 404'd → added `app/page.tsx` redirect; no `<title>` → added i18n
> `generateMetadata`. See the plan's Task 12 note. Don't assume later modules
> exist — check the plan's checkbox state.

Puck is decomposed into four sub-projects, built in dependency order **1 → 2 → 3
→ 4**:

| #     | Sub-project                               | Scope                                                                                               | Status                                                          |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **1** | **Foundation** — identity + RBAC + domain | Supabase Auth, users, event/session/occurrence schema, owner/delegate permissions, RLS, audit       | ✅ complete (12 migrations + packages/auth + packages/db)       |
| **2** | **Authoring web app** (`apps/web`)        | Next.js admin: create/edit events & sessions, per-day view, recurrence, document uploads, delegates | 🔨 in progress — slice 1 (shell + auth) 13/13 done, uncommitted |
| **3** | **Notification engine**                   | two-level subscriptions, pgmq + pg_cron scheduling, fan-out, dedupe, Telegram/email delivery        | needs re-grounding on #1                                        |
| **4** | **Telegram consumer bot**                 | discovery, browse schedule, subscribe, set reminder offsets, link Telegram ↔ user                   | no spec yet                                                     |

Specs and plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`
— for #1 (foundation) and #2 (web app slice 1). The active plan is
`docs/superpowers/plans/2026-06-30-puck-web-shell-auth.md`; read it (and its
`specs/` design doc) before continuing #2.

## Repo boilerplate

The dev-backbone rails are fully in place (as of the boilerplate task set, 2026-06-21).
Design rationale: `docs/superpowers/specs/2026-06-21-repo-boilerplate-design.md`.
Implementation plan: `docs/superpowers/plans/2026-06-21-repo-boilerplate.md`.

Covers: root manifest + tsconfigs, ESLint flat config, Prettier, Husky hooks, knip/jscpd/madge,
`scripts/load-env.mjs` (`$secret:KEY` resolver), secretlint, `.env.*` surface, `.claude/` assistant
layer + MCP, CI workflows + deploy templates, Docker/Supabase infra, `orval.config.ts` codegen
template, and root `vitest.config.ts`.

## Design guidelines

> ⚠️ **Any Puck UI MUST follow `docs/design/README.md`** — the canonical, binding
> design standard (single source of truth for color, type, shape, motion, voice).

Puck's look is **Transit-app style: friendly but still serious** — phone-first,
the schedule itself is the hero, **functional color** (each track a hue, one
rationed `--now` signal), chunky rounded flat cards, oversized tabular times.
Brand anchor is **iris/indigo** (nod to _A Midsummer Night's Dream_); signature
is the pinned **"now" card** + the Puck **messenger-sprite / 40-minute orbit**
reminder moment. `globals.css` (Tailwind v4) and the `apps/web` component library
derive directly from the tokens in `docs/design/README.md`. Decision record + why:
`docs/design/2026-06-30-puck-visual-direction.md`. Reference screenshots:
`docs/design/assets/`.

## References

**Sister projects: `Z:\Github\libra` and `Z:\Github\Janus`.** Puck shares
their _toolchain and conventions_ — pnpm + Turbo monorepo, strict TypeScript,
ESLint (flat config) + Prettier, Vitest, Husky, secretlint/cspell, the
`.env` + `.secrets` discipline, kebab-case filenames, Supabase (Auth + RLS +
Storage), social login, and CI/CD style. Consult them for tooling decisions and
follow the same approach unless noted below.

Like the sisters, Puck **does** have a Next.js web app (sub-project #2). Unlike
them, Puck **also** runs backend services — a Fastify API and a Node worker — for
the notification engine. Mirror Libra/Janus for the web app; the backend
services are Puck's own addition.

> ⚠️ **Libra is in production. Never run anything against its database.**
> Puck has its own separate Supabase project. Never put Libra credentials
> in Puck's `.env`/`.secrets`, and never point `SUPABASE_URL` at it.

## Architecture rules (target design)

_These describe the architecture to build toward; no code implements them yet._

- **Clean / hexagonal layering.** A `@puck/core` package owns the domain model
  and **ports** (interfaces). Adapters (`@puck/db`, `@puck/queue`,
  `@puck/channels`, …) implement those ports. `apps/*` wire adapters to ports.
  Dependencies point inward — `core` imports no concrete SDK.
- **Permissions are first-class.** Authoring is governed by the owner/delegate
  RBAC model, enforced via Supabase RLS — not application-only checks. See the
  foundation spec for the permission keys and override rules.
- **Channels are swappable.** A new channel (Discord, SMS, push, WhatsApp) is
  added by implementing the `NotificationChannel` port and registering it — never
  by editing core or the worker.
- **The queue is swappable too.** The default is `pgmq` (in Supabase Postgres,
  zero extra infra). Anything depending on a queue uses the `Queue` port.
- **Idempotency is sacred.** Every notification carries a deterministic
  `dedupe_key` with a UNIQUE constraint — the no-duplicate-sends guarantee. With
  two-level subscriptions the key is per (trigger, subscription, channel): a
  session reminder keys on occurrence + offset; a daily digest keys on event +
  date. The exact contract lands with sub-project #3's re-grounded design.
  Never weaken it.
- **Outbox pattern.** Schedule changes are persisted; a DB trigger enqueues
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
- **TDD is the default.** Write every feature and bugfix **test-first**: a failing
  test (RED) → minimal code to pass (GREEN) → refactor. Don't write implementation
  before its test. See `.claude/rules/testing.md`.

## Commands

```bash
pnpm install            # install workspace deps
pnpm dev                # run all apps (turbo)
pnpm typecheck          # tsc --noEmit across workspace
pnpm test               # vitest (unit tests; packages/auth passes now)
pnpm lint / pnpm format # eslint / prettier
pnpm db:start           # local Supabase (Postgres + pgmq + pg_cron)
pnpm db:reset           # apply supabase/migrations
pnpm db:types           # regenerate generated Supabase types (requires Docker in PATH)
pnpm test:db            # DB-integration tests — requires local Supabase running (`pnpm db:start`)
```

### Key packages

- **`packages/auth`** (`@puck/auth`) — permission key catalog (`PERMISSION_KEYS`, 28 keys) and
  `matchesPermissions(granted, required, mode)` helper. No DB dependency; pure unit-tested.
- **`packages/db`** (`@puck/db`) — generated Supabase TypeScript types. Re-run `pnpm db:types`
  after any schema migration. The generated `database.types.ts` is excluded from lint/format/cspell.

## Definition of done for a change

0. Built test-first (TDD): a failing test preceded the implementation.
1. `pnpm typecheck` clean.
2. `pnpm test` green (add/adjust tests for new logic).
3. `pnpm lint` and `pnpm format:check` clean.
4. New env vars added to `.env.example`, validated in config, and documented in
   the README.
5. Schema changes are a new `supabase/migrations/*.sql` file (never edit an
   applied migration), and `pnpm db:types` is re-run.
