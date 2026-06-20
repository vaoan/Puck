# Puck — scaffold brainstorm & gap analysis

_Date: 2026-06-19. Captured right after the initial scaffold so we know what we
deliberately deferred. This is a backlog, not a spec — revisit before building._

The scaffold gives us a correct, fail-safe **skeleton**: domain model, ports,
swappable channels, outbox + dedupe, pgmq/pg_cron pipeline, Fastify API, worker.
Below is what's **missing** to reach a working MVP and beyond, grouped and
prioritized. Each item notes rough effort and whether it blocks the first
end-to-end demo.

Legend: 🔴 blocks MVP · 🟡 important soon · 🟢 later/nice-to-have

---

## 1. Product / UX

- 🔴 **Subscription onboarding & verification.** We store
  `channel_subscriptions.verified` but have no flow to _create_ one:
  - Telegram: deep-link `t.me/<bot>?start=<token>`; `/start` handler maps the
    chat id to a Puck user and marks it verified.
  - Email: send a verification link, confirm before sending real mail.
    Without this, nobody can actually receive notifications. **This is the #1 gap.**
- 🔴 **Where do events come from?** Define the **Janus → Puck integration**: does
  Janus POST event changes to `/internal/event-changes`? Shared `external_id` /
  `source`? This is a product decision that shapes the data flow.
- 🟡 **Unsubscribe / unfollow link in emails** (and `/stop` in Telegram).
  Legally expected (CAN-SPAM/GDPR) for the email channel.
- 🟡 **Per-follow notification preferences:** which change types, which channels,
  reminder lead time(s). We have `muted_types`; extend to channel choice and
  configurable "starting soon" windows (e.g. 1 day + 1 hour).
- 🟡 **Coalescing / debounce.** Rapid successive changes (three schedule edits in
  a minute) should not fire three notifications. Needs a short quiet window or
  "supersede pending" rule.
- 🟢 **Quiet hours / digest mode** per user.
- 🟢 **i18n.** Sisters are bilingual (EN/ES); message templates in
  `core/services/render.ts` are English-only. Add locale per subscription.
- 🟢 **Notification history** surface for users.

## 2. Domain model

- 🟡 **Timezones.** `starts_at` is `timestamptz`; lead-time math and display
  should respect each user's tz.
- 🟡 **Announcement content.** `announcement` is just an `event_change` today; a
  richer announcements table may be warranted if they have titles/bodies/links.
- 🟡 **Upstream dedupe contract.** `schedule_changed`/`location_changed` can
  recur; define how callers compute `dedupe_key` so repeats don't re-notify
  unintentionally (and intended re-notifies _do_ get through).
- 🟢 **Event sources beyond Janus** (manual, ICS import, other platforms).

## 3. Reliability / correctness

- 🟡 **Exponential backoff.** pgmq redelivers after a fixed visibility timeout.
  Scale the timeout by `read_ct` (already surfaced on `QueueMessage.readCount`)
  for real backoff instead of a fixed retry cadence.
- 🟡 **Telegram rate limits** (30 msg/s global, 1/s per chat). Add
  `@grammyjs/transformer-throttler` + `@grammyjs/auto-retry` so bulk fan-out
  respects `retry_after` instead of hitting 429s.
- 🟡 **Worker health/liveness.** The worker has no HTTP surface; add a tiny
  health endpoint or heartbeat row so a container orchestrator can restart it.
- 🟡 **Dead-letter ops.** Messages get `archive`d, but there's no way to inspect
  or replay them. Add a small admin script/query.
- 🟢 **Concurrent message handling** in the worker (currently sequential per
  batch). Fine for v1; revisit under load.
- 🟢 **Queue depth / lag metrics** to know when we're falling behind.

## 4. Security

- ✅ **Internal endpoint auth** — added: `/internal/event-changes` now requires
  `x-puck-internal-key` (fails closed). Set `INTERNAL_API_KEY` in prod.
- 🔴 **User auth on `/follows`.** Currently trusts `userId` in the body. Derive
  the user from a verified Supabase JWT and enforce ownership before launch.
- 🟡 **Secret loading parity.** Sisters resolve `.secrets` at runtime; we rely on
  process env / `.env`. Decide whether to port a `load-env` step or use plain
  container env vars (cheaper, simpler).
- 🟡 **Production-DB guardrail.** Optional: refuse to boot if `SUPABASE_URL`
  matches a blocklist (protects against accidentally pointing at CandyStore).
- 🟢 **PII handling policy** (retention, deletion on unfollow/account delete).

## 5. Ops / deployment / cost

- 🔴 **`pnpm install` + commit `pnpm-lock.yaml`.** Not yet run; CI's
  `--frozen-lockfile` will fail until the lockfile exists. Do this first thing
  in the Puck folder.
- 🟡 **Dockerfile(s) + compose** for `api` and `worker`, and a supervisord entry
  to co-locate them on the existing CandyStore host (zero new infra).
- 🟡 **Migration deploy.** A workflow/step running `supabase db push` against
  Puck's project on release.
- 🟡 **Env matrix.** Only `.env.example` exists. Add `.env.dev/.staging/.prod`
  if we mirror the sisters, or keep it lean with container env vars.
- 🟢 **Error tracking (Sentry)** and basic metrics/dashboards.
- 🟢 **`pg_cron` caveat:** confirm the job runs in the right database on Supabase
  and that lead-time/window are configurable, not hardcoded to 15 min.

## 6. Developer experience

- 🟡 **Seed data** (`supabase/seed.sql`): a demo event, follow, and verified
  subscription so `pnpm db:reset` gives a working local playground.
- 🟡 **CI depth.** Add `syncpack`/`ls-lint`/`cspell`/`secretlint` and Vitest
  coverage thresholds to the pipeline (configs exist; CI only runs
  lint/typecheck/test today).
- 🟢 **`.editorconfig`, `.vscode/extensions.json`, PR template,** branch
  protection notes (mirror sisters' git workflow: `feat/...`, `develop` ←
  features, `main` ← release/fix).
- 🟢 **Integration test** that runs the full pipeline against a local Supabase
  (insert change → assert notification rows + console email).

---

## Suggested first sprint (to a working end-to-end demo)

1. `pnpm install`, commit lockfile, get `pnpm typecheck && pnpm test` green.
2. Telegram `/start` onboarding → verified subscription (#1).
3. Real user auth on `/follows` (#4).
4. Seed data + a manual end-to-end run (insert event_change → Telegram message).
5. Decide & stub the Janus → Puck event ingestion contract (#1).

Everything else is iterative once the happy path works end to end.
