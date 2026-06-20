# Puck — Sub-project #1: Foundation (Identity + RBAC + Core Domain) — Design

- **Date:** 2026-06-19
- **Status:** Approved for implementation planning
- **Scope:** Sub-project #1 of the Puck platform (see `docs/2026-06-19-platform-roadmap.md`)
- **Author:** Heiner Angarita (with Claude)

## 1. Context & goal

Puck is a multi-tenant **event-scheduler + notification** platform. Organizers
create umbrella **events** (multi-day) containing **sessions** (happenings, which
may recur); end users subscribe to events (daily digests) and sessions
(reminders at chosen lead times). See the roadmap for the full product and the
4 sub-projects.

This sub-project builds the **foundation everything else stands on**: identity
(auth), the **CandyStore-style RBAC permission system**, the **core domain
schema** (events → sessions → occurrences + support-content documents), the
**delegation/ownership model** with its cascade rules, **deep auditing**, and
**RLS enforcement**. It is backend/database + auth wiring — **no UI** (that is
sub-project #2) and **no notification logic** (sub-project #3).

### Guiding principles

- **CandyStore-first:** start from how CandyStore solves it, reuse its proven
  patterns, then add Puck specifics. (Permission core, `has_permission`,
  delegation-as-side-table, audit system, OAuth, signup triggers.)
- **Fail-safe & cheap:** Supabase only (Postgres + Auth + RLS + Storage); no new
  infrastructure. Enforcement lives in Postgres (RLS), not just app code.
- **Own project:** Puck uses its **own** Supabase project. Never CandyStore's DB.

### Non-goals (explicitly deferred)

- Authoring/admin **web UI** → sub-project #2.
- **Notification engine** (subscriptions, reminders, digests, pgmq/pg_cron,
  channels) → sub-project #3 (already scaffolded; will re-ground on this schema).
- **Telegram bot** + event discovery → sub-project #4.

## 2. Permission model

### 2.1 Hierarchy (gated, cascading waterfall)

```
Absolute Admin (platform.admin)
  └─ grants `events.create` → makes a user an "event owner"   [gated]
        │
   Event Owner  (owner_id; created the event)
     ├─ Event Delegates    (scoped to THIS event;  permissions[] subset)
     └─ Session Owners      (scoped to THIS event;  may create/own sessions)
            │
        Session Owner  (owner_id on sessions they create)
          └─ Session Delegates (scoped to ONE session; permissions[] subset)
```

- Higher scope can act on everything below it (the **waterfall**).
- Every delegate grant is **scoped to one resource** and bounded by a granular
  `permissions[]` array (CandyStore `seller_admins` pattern).

### 2.2 Permission catalog (28 granular keys)

Granularity is by **blast radius** so a role can hold a low-risk capability
without the dangerous ones.

**Platform**

- `platform.admin` — absolute admin (assigns event owners, manages permissions,
  moderates anything)
- `events.create` — admin-granted gate to become an event owner
- `audit.read` — read the audit trail (see §5)

**Consumer defaults** (auto-granted on signup)

- `event.read`, `session.read`, `content.read` (browse + download published
  files), `subscriptions.manage` (used by #3/#4)

**Event — core** (owner implicit; grantable to event delegates)

- `event.edit_details` _(low risk: title/description/branding/venue)_
- `event.edit_schedule` _(high: event date range + timezone — moves reminders)_
- `event.manage_visibility` _(high: public/private + regenerate event code/QR)_
- `event.manage_lifecycle` _(high: draft/publish/unpublish/archive)_
- `event.cancel` _(severe: fires cancellation notices to all subscribers)_
- `event.broadcast` _(severe: announcement push to all subscribers)_
- `event.manage_delegates` _(severe: privilege escalation)_
- `event.manage_session_owners` _(high: controls who runs the programme)_
- `event.moderate_sessions` _(high: override into any session below)_
- `event.delete` _(severe: destroys data)_

**Event — support content/files** (independent of core editing)

- `event_content.create` (upload), `event_content.update` (replace/rename),
  `event_content.delete` — act on **any** file in the event's space

**Session — core** (owner implicit; grantable to session delegates)

- `session.create`, `session.edit_details`,
  `session.edit_schedule` _(its delicate field — drives reminders)_,
  `session.delete`, `session.manage_delegates`

**Session — support content/files**

- `session_content.create`, `session_content.update`, `session_content.delete`

### 2.3 Quick-assign templates (4)

The granular keys remain individually assignable (custom). On top, **4 presets**
pre-fill the `permissions[]` array (editable after). The 3 "nuclear" keys
(`event.delete`, `event.cancel`, `event.manage_delegates`) are never in a preset.

| Template (event scope)     | Bundled keys                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| **Co-organizer**           | all `event.*` + `event_content.*` except `delete`, `cancel`, `manage_delegates`          |
| **Programme manager**      | `event.edit_schedule`, `manage_session_owners`, `moderate_sessions`, `session_content.*` |
| **Designer**               | `event_content.*` (+ `session_content.*`) — support-content steward                      |
| **Communications manager** | `event.broadcast` (+ read)                                                               |

Sessions reuse this minimally: a **Session delegate** preset (full `session.*` +
`session_content.*`) and reuse of **Designer** for content-only. Templates are
editable later.

### 2.4 Orphan cascade

When an event actor (owner, or delegate with `event.moderate_sessions` /
`event.manage_session_owners`) revokes a session owner:

1. Removing the `event_session_owners` row nulls `owner_id` on that user's
   sessions in the event.
2. A trigger on `sessions` (when `owner_id` becomes NULL) deletes that session's
   `session_delegates`.
3. The session is now an **orphan**, managed via `event.moderate_sessions`.

## 3. Data model

### 3.1 Copied from CandyStore (identity + permission core)

- **`user_profiles`** — `id` (PK = `auth.users.id`), `email`, `provider`,
  `display_name`, `avatar_url`, `first_seen_at`, `last_seen_at`, timestamps.
- **`permissions`** — `id`, `key` (unique), `name`, `description`,
  `scope` (`platform`|`event`|`session`|`content`).
- **`user_permissions`** — **global** grants: `id`, `user_id`, `permission_id`,
  `mode` (`grant`|`deny`), `expires_at`, `granted_by`, `reason`, timestamps.
- **`has_global_permission(user_id, key) → boolean`** — CandyStore's
  `has_permission` logic: a `grant` exists, no active `deny`, not expired.

> **Adaptation:** CandyStore's `resource_permissions` indirection table is
> dropped. Global perms live in `user_permissions`; resource-scoped perms live on
> the delegation rows (§3.3).

### 3.2 Puck domain

- **`events`** — `id`, `owner_id`→`user_profiles`, `title`, `description`,
  `category`, `banner_url`, `venue`, `start_date`, `end_date`, `timezone`,
  `status` (`draft`|`published`|`canceled`|`archived`),
  `visibility` (`public`|`private`), `event_code` (unique, for deep-link/QR
  discovery), timestamps.
- **`sessions`** — `id`, `event_id`→`events` (ON DELETE CASCADE),
  `owner_id`→`user_profiles` **NULLABLE** (NULL = orphan), `title`,
  `description`, `track` (optional label), `status`, timestamps.
- **`session_occurrences`** — `id`, `session_id`→`sessions` (CASCADE),
  `starts_at` (timestamptz), `ends_at` (timestamptz, nullable). **One row per
  occurrence** (one-off = 1 row; recurring/daily = many). Reminders, digests,
  and per-day views all read occurrences. (Recurrence-ready without an RRULE
  engine.)
- **`documents`** (support-content space) — `id`, `event_id` **XOR**
  `session_id` (CHECK: exactly one set), `storage_path` (Supabase Storage),
  `filename`, `content_type`, `size_bytes`, `title`, `is_published`,
  `uploaded_by`, timestamps.

### 3.3 Scoped grants / delegation (two levels)

- **`event_delegates`** — `id`, `event_id`, `user_id`, `permissions text[]`,
  `granted_by`, timestamps, `UNIQUE(event_id, user_id)`.
- **`event_session_owners`** — `id`, `event_id`, `user_id`, `granted_by`,
  timestamps, `UNIQUE(event_id, user_id)`. Membership = "may create/own sessions
  in this event".
- **`session_delegates`** — `id`, `session_id`, `user_id`, `permissions text[]`,
  `granted_by`, timestamps, `UNIQUE(session_id, user_id)`.

## 4. Enforcement

Most granular keys align to **table boundaries**, so RLS is clean; the few
sub-row severe actions are explicit RPCs.

**Waterfall helper functions** (SECURITY DEFINER) — the cascade lives here:

- `can_edit_event(event_id, key)` = `platform.admin` OR owner OR
  event-delegate holds `key`.
- `can_act_on_session(session_id, key)` = `platform.admin` OR session owner OR
  session-delegate holds `key` OR parent-event authority (owner / delegate with
  `event.moderate_sessions`).

**RLS policies** (RLS enabled on every table; service role bypasses):

| Resource / op                   | Gate                                                              |
| ------------------------------- | ----------------------------------------------------------------- |
| `events` SELECT                 | published+public, OR any event authority, OR admin                |
| `events` INSERT                 | `has_global_permission(uid,'events.create')` AND `owner_id = uid` |
| `events` UPDATE (detail fields) | `can_edit_event(id,'event.edit_details')`                         |
| `sessions` writes               | `can_act_on_session(id, 'session.*')` per op                      |
| `session_occurrences` writes    | `can_act_on_session(session_id,'session.edit_schedule')`          |
| `documents` writes              | `can_edit_event`/`can_act_on_session` with `*_content.*`          |
| `documents` SELECT              | `is_published` (public) OR authority                              |
| delegation tables               | owner / `*.manage_delegates` / `manage_session_owners`            |

**Severe, sub-row actions = `SECURITY DEFINER` RPCs**, each checking its key:

- `cancel_event(id)` → `event.cancel`
- `publish_event(id)` / `set_event_visibility(id, …)` →
  `event.manage_lifecycle` / `event.manage_visibility`
- `broadcast_announcement(event_id, …)` → `event.broadcast`
  (These also become the natural hook points for #3's notifications.)

## 5. Auditing (deep, immutable — mirrors CandyStore)

- **`audit` schema** + **`audit.logged_actions`**: `id`, `table_name`,
  `record_id`, `action` (INSERT/UPDATE/DELETE), `actor_id` (`auth.uid()`),
  `old_data` jsonb, `new_data` jsonb, `changed_columns text[]`, `changed_at`,
  `txid`, `context` jsonb.
- **`audit.log_changes()` trigger** on **every** domain + permission table
  (events, sessions, session_occurrences, documents, event_delegates,
  session_delegates, event_session_owners, user_permissions) — full before/after
  snapshots.
- **Immutable/append-only:** UPDATE and DELETE on audit rows blocked by trigger.
- **Read access:** gated by `audit.read`. Platform admin sees all; **event
  owners/delegates with `audit.read` see audit for their own event's
  resources** (scoped read — a Puck enhancement over CandyStore's global-only
  read).

## 6. Authentication (copy CandyStore)

- Supabase Auth, **Google + Discord** providers (same as the sisters).
- **Signup triggers** on `auth.users` INSERT: (a) upsert `user_profiles`;
  (b) grant default consumer permissions (`event.read`, `session.read`,
  `content.read`, `subscriptions.manage`).
- Shared **`packages/auth`** skeleton (permission hook + cross-domain cache,
  adapted to Puck's tables). The **login UI lives in sub-project #2**; this
  sub-project sets up providers, triggers, helpers, and RLS only.

## 7. Testing strategy

**TDD throughout** (write tests first, red → green). Deep coverage with minimal
redundancy.

- **Unit tests** for all TypeScript permission/auth helpers in `packages/auth`.
- **DB-integration tests** against a local Supabase, the core of this
  sub-project:
  - **Permission matrix:** seed users in each preset/role and assert the
    allow/deny matrix from §2 (e.g. Designer can CRUD `documents` but is denied
    `cancel_event`; Communications manager can `broadcast_announcement` but
    cannot edit details/schedule).
  - **Cascade:** revoke a session owner → assert sessions orphan +
    session_delegates deleted + event moderator can still act.
  - **Audit:** mutate rows → assert complete `logged_actions` entries (correct
    actor, before/after, changed columns); assert audit rows cannot be
    updated/deleted.
- **Playwright E2E** does **not** apply here (no UI). It begins in sub-project #2
  and follows the project rule: cover all paths but **minimize redundancy** —
  prefer extending an existing journey with a few extra steps/assertions over
  adding a near-duplicate test. The bot (#4) gets its own harness, not Playwright.

## 8. Implementation outline (for the plan)

Migrations (new Supabase project, in order):

1. `user_profiles` + `auth.users` sync trigger (copy/adapt CandyStore).
2. `permissions` catalog + seed the ~29 keys; `user_permissions` +
   `has_global_permission()` (copy/adapt).
3. Default-consumer-permissions signup trigger.
4. Domain: `events`, `sessions`, `session_occurrences`, `documents`.
5. Delegation: `event_delegates`, `event_session_owners`, `session_delegates`.
6. Waterfall helpers + RLS policies on all tables.
7. Severe-action RPCs (`cancel_event`, `publish_event`,
   `set_event_visibility`, `broadcast_announcement` stub).
8. Orphan-cascade triggers.
9. `audit` schema, `audit.logged_actions`, `log_changes()` trigger on all
   tables, immutability guard, scoped audit-read RLS.
10. `packages/auth` skeleton + permission helper/hook; Supabase provider config
    (Google/Discord) docs.

## 9. Open / deferred decisions

- **Designer reach default:** event-level Designer manages session content too,
  or event-only unless granted per session? (Lean: event-only by default;
  grant `session_content.*` per session for cross-cutting designers.)
- **Role-preset definitions** are intentionally editable later.
- **`event_code`** discovery semantics (length, regeneration UX, QR) fully
  designed in sub-project #4; the column lives here.
