<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/puck-banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/puck-banner-light.svg">
  <img alt="Puck — event scheduling & reminders platform" src="assets/puck-banner-dark.svg" width="100%">
</picture>

<br><br>

[![CI](https://github.com/vaoan/Puck/actions/workflows/ci.yml/badge.svg)](https://github.com/vaoan/Puck/actions/workflows/ci.yml)
&nbsp;![Status](https://img.shields.io/badge/status-planning-E8A33D?style=flat-square)
&nbsp;![Node](https://img.shields.io/badge/Node-24-0E7C73?style=flat-square)
&nbsp;![pnpm](https://img.shields.io/badge/pnpm-10-0E7C73?style=flat-square)
&nbsp;![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E7C73?style=flat-square)
&nbsp;![License](https://img.shields.io/badge/License-MIT-0E7C73?style=flat-square)

<br>

**Schedule the event. Puck reminds everyone at exactly the right minute.**

Puck is an event-scheduling platform with a reminder engine built in. Organizers
author multi-day **events** and the **sessions** inside them; people subscribe to
what they care about and get a nudge before it starts — over **Telegram** and
**email**, with more channels designed to drop in later.

<sub>Named after Puck, the small, quick inner moon of Uranus — fast, reliable, and out of your way.</sub>

</div>

---

## The whole idea, in one ladder

A session has a start time. The only question that matters is _how far ahead do
you want to know_ — so that's the spine of the whole product:

```
                                              session
   T‑30        T‑15        T‑10        T‑5     ▶ start
    │           │           │           │        │
    └───────────┴──── pick any, per subscription ┴──── ping
```

People subscribe at **two levels**, and Puck does the rest:

```
  ┌ subscribe to an EVENT    → one daily digest each morning it runs
  └ subscribe to a SESSION   → reminders at the lead times you pick above
```

No upstream feed, no scraping — Puck **owns** the schedule. Organizers author it;
Puck watches the clock and fans the reminders out.

## Who does what

| Role                         | Can                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------- |
| **Event owner**              | Create the event, manage its schedule, appoint delegates, moderate what gets sent |
| **Event delegate**           | Edit the event and any session in it; override session-level settings             |
| **Session owner / delegate** | Edit their session and upload documents to it anytime                             |
| **Anyone**                   | Create their own session inside an event; discover events and subscribe           |

Authoring is governed by a CandyStore-style permission system — owners and
delegates, enforced in the database with row-level security — not a single
all-powerful admin.

## Build roadmap

Puck is one platform decomposed into four sub-projects, each with its own
spec → plan → build cycle. They ship in dependency order.

| #      | Sub-project           | What it delivers                                                                               | Status               |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| **01** | **Foundation**        | Identity, the CandyStore-style RBAC, and the event → session → occurrence domain (RLS + audit) | 📐 spec + plan ready |
| **02** | **Authoring web app** | Next.js admin: build the schedule, manage delegates, upload documents, moderate                | 💭 idea              |
| **03** | **Reminder engine**   | Two-level subscriptions, `pgmq` + `pg_cron` scheduling, fan-out, dedupe, delivery              | 💭 idea              |
| **04** | **Telegram bot**      | Discover events, browse the schedule, subscribe, set lead times, link your account             | 💭 idea              |

> **Status: planning.** This repository currently holds the **design docs and the
> toolchain** — the ideas and the rails, not the implementation. Start with
> [`docs/2026-06-19-platform-roadmap.md`](docs/2026-06-19-platform-roadmap.md),
> then the foundation spec and plan under [`docs/superpowers/`](docs/superpowers/).

## Design principles

These are the rules the build will hold to — chosen so the platform stays cheap
to run and impossible to spam.

| Principle               | What it means                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| 🧭 **Hexagonal core**   | The domain depends on ports, not SDKs — so channels and the queue are swappable by design.                 |
| 🧱 **Outbox-durable**   | A schedule change and its fan-out job commit in one transaction — never lost, never phantom.               |
| 🔁 **Idempotent**       | Every reminder carries a deterministic `dedupe_key` with a UNIQUE constraint. A reminder can't fire twice. |
| ♻️ **Durable retries**  | Failed sends back off and re-queue; permanent failures and exhausted attempts dead-letter for inspection.  |
| 🪶 **Zero extra infra** | The queue (`pgmq`) and scheduler (`pg_cron`) live inside Supabase Postgres. No Redis, no new bills.        |
| 🛰️ **Multi-channel**    | Telegram & email first; a new channel is a class that implements one port, not a rewrite.                  |

## Toolchain

> Requires **Node 24** (see `.nvmrc`) and **pnpm 10**. Local Supabase needs the
> [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```bash
pnpm install      # install workspace deps
pnpm typecheck    # tsc --noEmit across the workspace
pnpm test         # vitest
pnpm lint         # eslint (flat config)
pnpm db:start     # local Supabase: Postgres + pgmq + pg_cron + Auth
```

A pnpm + Turbo monorepo with strict TypeScript (ESM / NodeNext), zod at every
boundary, and Vitest. The scripts above are wired and waiting; they no-op until
sub-project 01 lands the first package.

> ⚠️ **Puck uses its own Supabase project.** Never point `SUPABASE_URL` /
> `SUPABASE_SERVICE_ROLE_KEY` at CandyStore or any shared / production database.

<details>
<summary><b>Sister projects & conventions</b></summary>

<br>

Puck shares its toolchain DNA with **CandyStore** and **Janus** — the same pnpm +
Turbo monorepo, strict TypeScript, ESLint flat config + Prettier, Vitest, Husky,
secretlint/cspell, the `.env` + `.secrets` discipline, kebab-case filenames, and
Supabase (Auth + RLS + Storage). Like them, Puck has a Next.js web app
(sub-project 02); unlike them, it also runs backend services — a Fastify API and a
Node worker — for the reminder engine.

</details>

## License

[MIT](LICENSE) © Heiner Angarita
