# Puck — platform roadmap & decomposition

_Date: 2026-06-19. Outcome of the brainstorming session. Puck is larger than the
initial notification scaffold: it is a multi-tenant event-scheduler platform.
This decomposes it into sub-projects, each of which gets its own
spec → plan → build cycle._

## Product in one paragraph

Puck is an **event scheduler**. Organizers create umbrella **events** (multi-day
festivals/conferences) containing a flat schedule of **sessions** (happenings,
each with a start time; sessions may **recur**). Authoring is governed by a
**Libra-style permission system** — not a single admin. End users discover
events, **subscribe to a whole event** (→ a **daily digest** of that day's
schedule while the event runs) and/or **subscribe to individual sessions**,
choosing reminder lead times (**30 / 15 / 10 / 5 min before, and at start** —
multiple at once). Users interact through a **Telegram bot**; notifications go
to **Telegram and email**.

## Permission model (high level — to be specified in sub-project 1)

- **Event**: an **owner** + **delegates**. Delegates can edit the event, edit
  any of its sessions, and **override session-level permissions** to moderate
  what gets delivered.
- **Session**: an **owner** + a **delegate**. Owners/delegates edit the session
  and upload documents/files anytime.
- Users may create their own sessions within an event.

## Sub-projects (dependency order)

| #     | Sub-project                                       | Scope                                                                                                                                                                                  | Depends on |
| ----- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **1** | **Foundation: identity + RBAC + core domain**     | Supabase Auth (social login, like Libra), users, event/session schema (with recurrence-ready occurrences), and the owner/delegate permission model + override rules (enforced via RLS) | —          |
| **2** | **Authoring web app**                             | Next.js admin mirroring the sisters: create/edit events & sessions, per-day view, recurrence, document uploads (Supabase Storage), delegate management, moderation                     | 1          |
| **3** | **Notification engine** _(scaffolded 2026-06-19)_ | two-level subscriptions (event daily-digest + per-session reminders at 30/15/10/5/start), pgmq + pg_cron scheduling, fan-out, dedupe, Telegram/email delivery                          | 1, 2       |
| **4** | **Telegram consumer bot**                         | discovery (deep-link codes / QR / search), browse schedule, subscribe, set reminder offsets, link Telegram ↔ user                                                                      | 1, 2, 3    |

## Notes & open tensions

- **Scope vs. cost:** this is Libra-sized. The "cheap/unfunded" constraint
  still holds (Supabase + pgmq/pg_cron, no Redis; self-host alongside the
  existing Libra box), but sequencing for value matters.
- **The existing scaffold (`apps/api`, `apps/worker`, `packages/*`) covers most
  of sub-project 3** but must be re-grounded on the real domain model from
  sub-project 1 (events → sessions → occurrences; two-level subscriptions with
  reminder offsets; daily digests).
- **Stack addition:** sub-project 2 adds a Next.js `apps/web` (mirrors
  Libra/Janus), so Puck is no longer strictly backend-only.
- Puck uses its **own Supabase project** — never Libra's.

## Current status

- Building order: **1 → 2 → 3 → 4**.
- **Sub-project 1 (Foundation) — ✅ complete & merged to `develop`.** 12 Supabase
  migrations (identity/`user_profiles`, 28-key RBAC catalog, event → session →
  occurrence domain, two-level delegation, RLS, severe-action RPCs, audit) plus
  `@puck/auth` (permission catalog + `matchesPermissions`) and `@puck/db`
  (generated types). Spec + plan in `docs/superpowers/{specs,plans}/`.
- **Sub-project 2 (Authoring web app) — 🔨 in progress** on branch
  `feat/GH-5_App-Shell-Auth`. Slice 1 (app shell + social auth + account) is a
  13-task TDD plan; **tasks 1–2 of 13 done** (`apps/web` scaffold + vitest/RTL
  harness; `@puck/ui` = Puck OKLCH tokens + base shadcn components). Task 3
  (Supabase clients + env) is next. Plan:
  `docs/superpowers/plans/2026-06-30-puck-web-shell-auth.md`.
- **Sub-projects 3 (reminder engine) & 4 (Telegram bot) — not started.** #3
  re-grounds on #1; #4 has no spec yet.
