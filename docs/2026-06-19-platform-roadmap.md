# Puck — platform roadmap & decomposition

_Date: 2026-06-19. Outcome of the brainstorming session. Puck is larger than the
initial notification scaffold: it is a multi-tenant event-scheduler platform.
This decomposes it into sub-projects, each of which gets its own
spec → plan → build cycle._

## Product in one paragraph

Puck is an **event scheduler**. Organizers create umbrella **events** (multi-day
festivals/conferences) containing a flat schedule of **sessions** (happenings,
each with a start time; sessions may **recur**). Authoring is governed by a
**CandyStore-style permission system** — not a single admin. End users discover
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

| # | Sub-project | Scope | Depends on |
|---|-------------|-------|------------|
| **1** | **Foundation: identity + RBAC + core domain** | Supabase Auth (social login, like CandyStore), users, event/session schema (with recurrence-ready occurrences), and the owner/delegate permission model + override rules (enforced via RLS) | — |
| **2** | **Authoring web app** | Next.js admin mirroring the sisters: create/edit events & sessions, per-day view, recurrence, document uploads (Supabase Storage), delegate management, moderation | 1 |
| **3** | **Notification engine** _(scaffolded 2026-06-19)_ | two-level subscriptions (event daily-digest + per-session reminders at 30/15/10/5/start), pgmq + pg_cron scheduling, fan-out, dedupe, Telegram/email delivery | 1, 2 |
| **4** | **Telegram consumer bot** | discovery (deep-link codes / QR / search), browse schedule, subscribe, set reminder offsets, link Telegram ↔ user | 1, 2, 3 |

## Notes & open tensions

- **Scope vs. cost:** this is CandyStore-sized. The "cheap/unfunded" constraint
  still holds (Supabase + pgmq/pg_cron, no Redis; self-host alongside the
  existing CandyStore box), but sequencing for value matters.
- **The existing scaffold (`apps/api`, `apps/worker`, `packages/*`) covers most
  of sub-project 3** but must be re-grounded on the real domain model from
  sub-project 1 (events → sessions → occurrences; two-level subscriptions with
  reminder offsets; daily digests).
- **Stack addition:** sub-project 2 adds a Next.js `apps/web` (mirrors
  CandyStore/Janus), so Puck is no longer strictly backend-only.
- Puck uses its **own Supabase project** — never CandyStore's.

## Current status

- Building order: **1 → 2 → 3 → 4**.
- **Now brainstorming sub-project 1.** Its design spec will land in
  `docs/superpowers/specs/`.
