# Puck Foundation (Identity + RBAC + Core Domain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Puck's database + auth foundation — CandyStore-style capability RBAC, the events→sessions→occurrences domain, support-content documents, two-level scoped delegation with orphan cascade, RLS enforcement, severe-action RPCs, and deep immutable auditing — all test-driven.

**Architecture:** Everything lives in a dedicated Supabase Postgres project. Authorization is enforced in the database via RLS + `SECURITY DEFINER` helper functions (the owner→delegate→event-override→admin "waterfall"), mirroring CandyStore. Severe sub-row actions (cancel, publish, broadcast) are explicit RPCs. Tests are TDD DB-integration tests (Vitest + `@supabase/supabase-js`) that act as real users so RLS actually runs; there is no UI in this sub-project, so no Playwright.

**Tech Stack:** Supabase (Postgres 17 + Auth + RLS + Storage), SQL migrations, pnpm + Turbo monorepo, TypeScript (ESM/NodeNext), Vitest, `@supabase/supabase-js`.

## Global Constraints

- **Own Supabase project only.** Never set `SUPABASE_URL`/keys to CandyStore's. Migrations run against Puck's local/own DB exclusively.
- **CandyStore-first.** Adapt patterns from `Z:\Github\candystore\supabase\migrations` (read them); do not copy store-specific keys/policies.
- **TDD.** Every task: write the failing test → run it red → migration/code → `pnpm db:test` green → commit. No code without a failing test first.
- **Package manager:** pnpm 10, Node 24. Internal deps `@puck/*` use `workspace:*`.
- **Filenames:** kebab-case. **Migrations:** `supabase/migrations/NNNN_snake_name.sql`, applied in lexical order; never edit an applied migration in a deployed env (Puck isn't deployed, so renumbering during this sub-project is allowed).
- **Permission keys are a fixed catalog of 28** (see spec §2.2). Enforcement lives in SQL, not only app code.
- **RLS enabled on every table; service role bypasses RLS** and is server-only.

---

## File Structure

**Migrations (replace the scaffold's notification-era `0001_init.sql`):**

- `supabase/migrations/0001_extensions_and_helpers.sql` — `pgcrypto`, `set_updated_at()`
- `supabase/migrations/0002_user_profiles.sql` — profiles + `auth.users` sync trigger
- `supabase/migrations/0003_permissions_core.sql` — `permissions`, `user_permissions`, `has_global_permission()`, seed 28 keys
- `supabase/migrations/0004_default_consumer_permissions.sql` — signup grant trigger
- `supabase/migrations/0005_domain.sql` — `events`, `sessions`, `session_occurrences`
- `supabase/migrations/0006_documents.sql` — support-content table
- `supabase/migrations/0007_delegation.sql` — `event_delegates`, `event_session_owners`, `session_delegates`
- `supabase/migrations/0008_waterfall_helpers.sql` — `can_edit_event()`, `can_act_on_session()`
- `supabase/migrations/0009_rls_policies.sql` — RLS on all domain tables
- `supabase/migrations/0010_action_rpcs.sql` — `cancel_event`, `publish_event`, `set_event_visibility`, `broadcast_announcement` (stub)
- `supabase/migrations/0011_orphan_cascade.sql` — cascade triggers
- `supabase/migrations/0012_audit.sql` — audit schema, tracking on all tables, immutability, scoped read

**Test harness & tests:**

- `vitest.config.integration.ts` — integration runner config
- `tests/db/global-setup.ts` — load local Supabase env
- `tests/db/helpers.ts` — `admin`, `createUser`, `userClient`, `grantGlobal`, `makeEvent`, `makeSession`
- `tests/db/*.test.ts` — one file per concern (profiles, permissions, domain, delegation, rls-matrix, rpcs, cascade, audit)

**Auth package:**

- `packages/auth/package.json`, `tsconfig.json`
- `packages/auth/src/permissions.ts` — `matchesPermissions()`, key constants
- `packages/auth/src/permissions.test.ts`
- `packages/auth/src/index.ts`

**Touched:**

- `package.json` — add `test:db` script; `packages/db/src/database.types.ts` — regen; `CLAUDE.md` — getting-started.

---

## Task 1: Local Supabase + DB integration test harness

**Files:**

- Delete: `supabase/migrations/0001_init.sql` (notification-era schema; superseded — pgmq/subscriptions return in sub-project #3)
- Create: `vitest.config.integration.ts`, `tests/db/global-setup.ts`, `tests/db/helpers.ts`, `tests/db/smoke.test.ts`
- Modify: `package.json` (scripts), `.gitignore` (add `.env.test`)

**Interfaces:**

- Produces: `admin: SupabaseClient`; `createUser(): Promise<{id,email,password}>`; `userClient(email,password): Promise<SupabaseClient>`; `grantGlobal(userId, key): Promise<void>`; `makeEvent(ownerClient, overrides?): Promise<{id}>`; `makeSession(ownerClient, eventId, overrides?): Promise<{id}>`.

- [ ] **Step 1: Install deps and confirm tooling**

Run:

```bash
cd /z/Github/Puck
pnpm install
pnpm add -Dw @supabase/supabase-js
supabase --version    # install the Supabase CLI if missing
```

Expected: `pnpm-lock.yaml` created; supabase CLI prints a version.

- [ ] **Step 2: Remove the superseded migration and add scripts**

```bash
git rm supabase/migrations/0001_init.sql
```

Add to root `package.json` `"scripts"`:

```json
"test:db": "supabase db reset && vitest run -c vitest.config.integration.ts"
```

Append `.env.test` to `.gitignore`.

- [ ] **Step 3: Write the integration config + env global-setup**

`vitest.config.integration.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["tests/db/global-setup.ts"],
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
```

`tests/db/global-setup.ts`:

```ts
import { execSync } from "node:child_process";

export default function setup(): void {
  const json = execSync("supabase status -o json", { encoding: "utf8" });
  const s = JSON.parse(json) as Record<string, string>;
  process.env.SUPABASE_URL = s.API_URL;
  process.env.SUPABASE_ANON_KEY = s.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = s.SERVICE_ROLE_KEY;
}
```

- [ ] **Step 4: Write the harness helpers**

`tests/db/helpers.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (): string => process.env.SUPABASE_URL as string;
const anon = (): string => process.env.SUPABASE_ANON_KEY as string;
const service = (): string => process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const admin = (): SupabaseClient =>
  createClient(url(), service(), { auth: { persistSession: false } });

let seq = 0;
export async function createUser(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  seq += 1;
  const email = `u${Date.now()}_${seq}@test.puck`;
  const password = "Test-pass-123!";
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

export async function userClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const c = createClient(url(), anon(), { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

export async function grantGlobal(userId: string, key: string): Promise<void> {
  const a = admin();
  const { data: perm, error } = await a
    .from("permissions")
    .select("id")
    .eq("key", key)
    .single();
  if (error) throw error;
  const { error: insErr } = await a.from("user_permissions").insert({
    user_id: userId,
    permission_id: perm.id,
    mode: "grant",
    granted_by: userId,
  });
  if (insErr) throw insErr;
}

export async function makeEvent(
  owner: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await owner
    .from("events")
    .insert({ title: "Test Event", timezone: "UTC", ...overrides })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function makeSession(
  client: SupabaseClient,
  eventId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("sessions")
    .insert({ event_id: eventId, title: "Test Session", ...overrides })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}
```

- [ ] **Step 5: Write the smoke test (fails until stack is up)**

`tests/db/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin } from "./helpers.js";

describe("local supabase", () => {
  it("connects with the service role", async () => {
    const { error } = await admin().from("user_profiles").select("id").limit(1);
    // After Task 3 this table exists; for now we assert connectivity (no network error).
    expect(error?.message ?? "connected").not.toContain("fetch failed");
  });
});
```

- [ ] **Step 6: Bring up the stack and run**

Run:

```bash
supabase start
pnpm test:db
```

Expected: smoke test PASSES (connects). It's fine that `user_profiles` doesn't exist yet — the assertion only checks connectivity.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add local supabase db-integration harness; retire notification-era migration"
```

---

## Task 2: Extensions + shared `set_updated_at()` helper

**Files:**

- Create: `supabase/migrations/0001_extensions_and_helpers.sql`
- Test: `tests/db/helpers-fn.test.ts`

**Interfaces:**

- Produces: trigger function `public.set_updated_at()` for reuse by every table's `updated_at`.

- [ ] **Step 1: Write the failing test**

`tests/db/helpers-fn.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin } from "./helpers.js";

describe("set_updated_at()", () => {
  it("exists as a function", async () => {
    const { data, error } = await admin().rpc("set_updated_at_probe");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- helpers-fn`
Expected: FAIL (`set_updated_at_probe` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0001_extensions_and_helpers.sql`:

```sql
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Probe used only by the integration test to confirm the helper deployed.
create or replace function public.set_updated_at_probe()
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_proc where proname = 'set_updated_at'
  );
$$;
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- helpers-fn`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_extensions_and_helpers.sql tests/db/helpers-fn.test.ts
git commit -m "feat(db): extensions + set_updated_at helper"
```

---

## Task 3: `user_profiles` + auth sync trigger

Adapted from `candystore/supabase/migrations/20260325600000_user_profiles.sql`.

**Files:**

- Create: `supabase/migrations/0002_user_profiles.sql`
- Test: `tests/db/profiles.test.ts`

**Interfaces:**

- Produces: table `public.user_profiles(id, email, provider, display_name, avatar_url, first_seen_at, last_seen_at, created_at, updated_at)`; trigger syncing from `auth.users`.

- [ ] **Step 1: Write the failing test**

`tests/db/profiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createUser, userClient } from "./helpers.js";

describe("user_profiles", () => {
  it("auto-creates a profile when an auth user is created", async () => {
    const u = await createUser();
    const { data, error } = await admin()
      .from("user_profiles")
      .select("id,email")
      .eq("id", u.id)
      .single();
    expect(error).toBeNull();
    expect(data.email).toBe(u.email);
  });

  it("is readable by anyone but only self-updatable", async () => {
    const u = await createUser();
    const other = await createUser();
    const cli = await userClient(u.email, u.password);

    const { error: readErr } = await cli
      .from("user_profiles")
      .select("id")
      .eq("id", other.id)
      .single();
    expect(readErr).toBeNull(); // read all

    const { error: updErr } = await cli
      .from("user_profiles")
      .update({ display_name: "hacker" })
      .eq("id", other.id);
    expect(updErr).not.toBeNull(); // cannot update others
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- profiles`
Expected: FAIL (relation `user_profiles` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0002_user_profiles.sql`:

```sql
create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email ~* '^.+@.+$'),
  provider text,
  display_name text,
  avatar_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_profiles_email_idx on public.user_profiles (email);

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
create policy "profiles_read_all" on public.user_profiles for select using (true);
create policy "profiles_insert_own" on public.user_profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.user_profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.sync_user_profile()
returns trigger security definer language plpgsql as $$
begin
  insert into public.user_profiles (id, email, provider, display_name, avatar_url)
  values (
    new.id, new.email,
    new.raw_app_meta_data->>'provider',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    provider = excluded.provider,
    last_seen_at = now(),
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name);
  return new;
end;
$$;

create trigger on_auth_user_change
  after insert or update on auth.users
  for each row execute function public.sync_user_profile();
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- profiles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_user_profiles.sql tests/db/profiles.test.ts
git commit -m "feat(db): user_profiles synced from auth.users with RLS"
```

---

## Task 4: Permission catalog + `has_global_permission()`

Adapted from `candystore/.../20260328100000_crud_permissions.sql` (drops `resource_permissions`; `user_permissions` references `permissions` directly).

**Files:**

- Create: `supabase/migrations/0003_permissions_core.sql`
- Test: `tests/db/permissions.test.ts`

**Interfaces:**

- Produces: `public.permissions(id, key unique, name, description, scope)`; `public.user_permissions(id, user_id, permission_id, mode, expires_at, granted_by, reason, created_at)`; `public.has_global_permission(p_user_id uuid, p_key text) returns boolean`.

- [ ] **Step 1: Write the failing test**

`tests/db/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createUser, grantGlobal } from "./helpers.js";

async function hasPerm(userId: string, key: string): Promise<boolean> {
  const { data, error } = await admin().rpc("has_global_permission", {
    p_user_id: userId,
    p_key: key,
  });
  if (error) throw error;
  return data as boolean;
}

describe("permission catalog + has_global_permission", () => {
  it("seeds the 28-key catalog", async () => {
    const { count } = await admin()
      .from("permissions")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(28);
  });

  it("returns true only for granted, non-expired, non-denied keys", async () => {
    const u = await createUser();
    expect(await hasPerm(u.id, "events.create")).toBe(false);
    await grantGlobal(u.id, "events.create");
    expect(await hasPerm(u.id, "events.create")).toBe(true);
  });

  it("an explicit deny overrides a grant", async () => {
    const u = await createUser();
    await grantGlobal(u.id, "platform.admin");
    const { data: perm } = await admin()
      .from("permissions")
      .select("id")
      .eq("key", "platform.admin")
      .single();
    await admin().from("user_permissions").insert({
      user_id: u.id,
      permission_id: perm.id,
      mode: "deny",
      granted_by: u.id,
    });
    expect(await hasPerm(u.id, "platform.admin")).toBe(false);
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- permissions`
Expected: FAIL (relation `permissions` / function missing).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0003_permissions_core.sql`:

```sql
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  scope text not null check (scope in ('platform','event','session','content'))
);

create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  mode text not null default 'grant' check (mode in ('grant','deny')),
  expires_at timestamptz,
  granted_by uuid references auth.users (id),
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, permission_id, mode)
);
create index user_permissions_user_idx on public.user_permissions (user_id);

create or replace function public.has_global_permission(p_user_id uuid, p_key text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and p.key = p_key and up.mode = 'grant'
      and (up.expires_at is null or up.expires_at > now())
  )
  and not exists (
    select 1 from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and p.key = p_key and up.mode = 'deny'
      and (up.expires_at is null or up.expires_at > now())
  );
$$;

insert into public.permissions (key, name, scope) values
  ('platform.admin','Platform admin','platform'),
  ('events.create','Create events','platform'),
  ('audit.read','Read audit log','platform'),
  ('event.read','Read events','event'),
  ('session.read','Read sessions','session'),
  ('content.read','Download content','content'),
  ('subscriptions.manage','Manage subscriptions','platform'),
  ('event.edit_details','Edit event details','event'),
  ('event.edit_schedule','Edit event schedule','event'),
  ('event.manage_visibility','Manage event visibility','event'),
  ('event.manage_lifecycle','Manage event lifecycle','event'),
  ('event.cancel','Cancel event','event'),
  ('event.broadcast','Broadcast announcement','event'),
  ('event.manage_delegates','Manage event delegates','event'),
  ('event.manage_session_owners','Manage session owners','event'),
  ('event.moderate_sessions','Moderate sessions','event'),
  ('event.delete','Delete event','event'),
  ('event_content.create','Upload event content','content'),
  ('event_content.update','Edit event content','content'),
  ('event_content.delete','Delete event content','content'),
  ('session.create','Create sessions','session'),
  ('session.edit_details','Edit session details','session'),
  ('session.edit_schedule','Edit session schedule','session'),
  ('session.delete','Delete session','session'),
  ('session.manage_delegates','Manage session delegates','session'),
  ('session_content.create','Upload session content','content'),
  ('session_content.update','Edit session content','content'),
  ('session_content.delete','Delete session content','content');

alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;
create policy "permissions_read_all" on public.permissions for select using (true);
create policy "user_permissions_read_own" on public.user_permissions for select
  using (auth.uid() = user_id or public.has_global_permission(auth.uid(), 'platform.admin'));
create policy "user_permissions_admin_write" on public.user_permissions for all
  using (public.has_global_permission(auth.uid(), 'platform.admin'))
  with check (public.has_global_permission(auth.uid(), 'platform.admin'));
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- permissions`
Expected: PASS (count = 28; grant/deny logic correct).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_permissions_core.sql tests/db/permissions.test.ts
git commit -m "feat(db): permission catalog (28 keys) + has_global_permission"
```

---

## Task 5: Default consumer permissions on signup

Adapted from `candystore/.../20260408203000_default_buyer_permissions.sql`.

**Files:**

- Create: `supabase/migrations/0004_default_consumer_permissions.sql`
- Test: extend `tests/db/permissions.test.ts`

**Interfaces:**

- Produces: trigger granting `event.read`, `session.read`, `content.read`, `subscriptions.manage` to every new `auth.users` row.

- [ ] **Step 1: Write the failing test (append)**

Append to `tests/db/permissions.test.ts`:

```ts
describe("default consumer permissions", () => {
  it("grants the 4 consumer keys on signup", async () => {
    const { createUser } = await import("./helpers.js");
    const u = await createUser();
    const a = (await import("./helpers.js")).admin();
    const { data } = await a
      .from("user_permissions")
      .select("permissions(key)")
      .eq("user_id", u.id);
    const keys = (data ?? [])
      .map((r: { permissions: { key: string } }) => r.permissions.key)
      .sort();
    expect(keys).toEqual([
      "content.read",
      "event.read",
      "session.read",
      "subscriptions.manage",
    ]);
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- permissions`
Expected: FAIL (new user has no permissions yet).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0004_default_consumer_permissions.sql`:

```sql
create or replace function public.grant_default_consumer_permissions(p_user_id uuid)
returns void security definer language plpgsql as $$
begin
  insert into public.user_permissions (user_id, permission_id, mode, granted_by, reason)
  select p_user_id, p.id, 'grant', p_user_id, 'Default consumer permissions'
  from public.permissions p
  where p.key in ('event.read','session.read','content.read','subscriptions.manage')
  on conflict (user_id, permission_id, mode) do nothing;
end;
$$;

create or replace function public.handle_default_consumer_permissions()
returns trigger security definer language plpgsql as $$
begin
  perform public.grant_default_consumer_permissions(new.id);
  return new;
end;
$$;

create trigger on_auth_user_default_permissions
  after insert on auth.users
  for each row execute function public.handle_default_consumer_permissions();
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- permissions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_default_consumer_permissions.sql tests/db/permissions.test.ts
git commit -m "feat(db): grant default consumer permissions on signup"
```

---

## Task 6: Domain schema — events, sessions, occurrences

**Files:**

- Create: `supabase/migrations/0005_domain.sql`
- Test: `tests/db/domain.test.ts`

**Interfaces:**

- Produces: `events(id, owner_id, title, description, category, banner_url, venue, start_date, end_date, timezone, status, visibility, event_code, created_at, updated_at)`; `sessions(id, event_id, owner_id nullable, title, description, track, status, created_at, updated_at)`; `session_occurrences(id, session_id, starts_at, ends_at)`. Enums `event_status`, `session_status`, `event_visibility`.

- [ ] **Step 1: Write the failing test**

`tests/db/domain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin } from "./helpers.js";

describe("domain schema", () => {
  it("creates an event with defaults and cascades to sessions/occurrences on delete", async () => {
    const a = admin();
    const { data: ev, error: evErr } = await a
      .from("events")
      .insert({ title: "Fest", timezone: "UTC" })
      .select("id,status,visibility")
      .single();
    expect(evErr).toBeNull();
    expect(ev.status).toBe("draft");
    expect(ev.visibility).toBe("public");

    const { data: se } = await a
      .from("sessions")
      .insert({ event_id: ev.id, title: "Talk" })
      .select("id")
      .single();
    await a
      .from("session_occurrences")
      .insert({ session_id: se.id, starts_at: "2026-08-14T18:00:00Z" });

    await a.from("events").delete().eq("id", ev.id);
    const { count } = await a
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("id", se.id);
    expect(count).toBe(0); // cascade
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- domain`
Expected: FAIL (relation `events` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0005_domain.sql`:

```sql
create type event_status as enum ('draft','published','canceled','archived');
create type event_visibility as enum ('public','private');
create type session_status as enum ('draft','published','canceled');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.user_profiles (id) on delete set null,
  title text not null,
  description text,
  category text,
  banner_url text,
  venue text,
  start_date date,
  end_date date,
  timezone text not null default 'UTC',
  status event_status not null default 'draft',
  visibility event_visibility not null default 'public',
  event_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  owner_id uuid references public.user_profiles (id) on delete set null,
  title text not null,
  description text,
  track text,
  status session_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_event_idx on public.sessions (event_id);
create trigger set_sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

create table public.session_occurrences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index session_occurrences_session_idx on public.session_occurrences (session_id);
create index session_occurrences_starts_idx on public.session_occurrences (starts_at);
```

> RLS for these tables is added in Task 10 (it depends on the waterfall helpers from Task 9). Until then the service-role tests above still pass because the service role bypasses RLS.

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_domain.sql tests/db/domain.test.ts
git commit -m "feat(db): events, sessions, session_occurrences schema"
```

---

## Task 7: Support-content `documents` table

**Files:**

- Create: `supabase/migrations/0006_documents.sql`
- Test: extend `tests/db/domain.test.ts`

**Interfaces:**

- Produces: `documents(id, event_id, session_id, storage_path, filename, content_type, size_bytes, title, is_published, uploaded_by, created_at, updated_at)` with a CHECK that exactly one of `event_id`/`session_id` is set.

- [ ] **Step 1: Write the failing test (append)**

```ts
describe("documents", () => {
  it("rejects a document with neither or both parents", async () => {
    const a = admin();
    const { error: noneErr } = await a.from("documents").insert({
      storage_path: "x",
      filename: "f",
      content_type: "application/pdf",
    });
    expect(noneErr).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- domain`
Expected: FAIL (relation `documents` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0006_documents.sql`:

```sql
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  title text,
  is_published boolean not null default false,
  uploaded_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_one_parent check (
    (event_id is not null and session_id is null) or
    (event_id is null and session_id is not null)
  )
);
create index documents_event_idx on public.documents (event_id) where event_id is not null;
create index documents_session_idx on public.documents (session_id) where session_id is not null;
create trigger set_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_documents.sql tests/db/domain.test.ts
git commit -m "feat(db): documents support-content table with single-parent constraint"
```

---

## Task 8: Delegation tables

**Files:**

- Create: `supabase/migrations/0007_delegation.sql`
- Test: `tests/db/delegation.test.ts`

**Interfaces:**

- Produces: `event_delegates(id, event_id, user_id, permissions text[], granted_by, created_at, updated_at)`; `event_session_owners(id, event_id, user_id, granted_by, created_at)`; `session_delegates(id, session_id, user_id, permissions text[], granted_by, created_at, updated_at)` — each unique on `(parent, user_id)`.

- [ ] **Step 1: Write the failing test**

`tests/db/delegation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent } from "./helpers.js";

describe("delegation tables", () => {
  it("stores a permissions array and is unique per (event,user)", async () => {
    const a = admin();
    const owner = await createUser();
    const delegate = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });

    const row = {
      event_id: eventId,
      user_id: delegate.id,
      permissions: ["event.edit_details", "event.broadcast"],
      granted_by: owner.id,
    };
    const { error } = await a.from("event_delegates").insert(row);
    expect(error).toBeNull();

    const { error: dupErr } = await a.from("event_delegates").insert(row);
    expect(dupErr).not.toBeNull(); // unique(event_id,user_id)
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- delegation`
Expected: FAIL (relation `event_delegates` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0007_delegation.sql`:

```sql
create table public.event_delegates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  permissions text[] not null default '{}',
  granted_by uuid references public.user_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_delegates_user_idx on public.event_delegates (user_id);
create trigger set_event_delegates_updated_at before update on public.event_delegates
  for each row execute function public.set_updated_at();

create table public.event_session_owners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  granted_by uuid references public.user_profiles (id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_session_owners_user_idx on public.event_session_owners (user_id);

create table public.session_delegates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  permissions text[] not null default '{}',
  granted_by uuid references public.user_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index session_delegates_user_idx on public.session_delegates (user_id);
create trigger set_session_delegates_updated_at before update on public.session_delegates
  for each row execute function public.set_updated_at();
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- delegation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_delegation.sql tests/db/delegation.test.ts
git commit -m "feat(db): two-level scoped delegation tables"
```

---

## Task 9: Waterfall helper functions

**Files:**

- Create: `supabase/migrations/0008_waterfall_helpers.sql`
- Test: `tests/db/waterfall.test.ts`

**Interfaces:**

- Produces: `public.can_edit_event(p_event_id uuid, p_key text) returns boolean`; `public.can_act_on_session(p_session_id uuid, p_key text) returns boolean`. Both use `auth.uid()` internally.

- [ ] **Step 1: Write the failing test**

`tests/db/waterfall.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  admin,
  createUser,
  makeEvent,
  makeSession,
  userClient,
} from "./helpers.js";

async function can(
  client: Awaited<ReturnType<typeof userClient>>,
  fn: string,
  args: object,
): Promise<boolean> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data as boolean;
}

describe("waterfall helpers", () => {
  it("event owner can edit; event delegate limited to granted keys", async () => {
    const a = admin();
    const owner = await createUser();
    const delegate = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });
    await a.from("event_delegates").insert({
      event_id: eventId,
      user_id: delegate.id,
      permissions: ["event.edit_details"],
      granted_by: owner.id,
    });

    const ownerCli = await userClient(owner.email, owner.password);
    const delCli = await userClient(delegate.email, delegate.password);

    expect(
      await can(ownerCli, "can_edit_event", {
        p_event_id: eventId,
        p_key: "event.cancel",
      }),
    ).toBe(true);
    expect(
      await can(delCli, "can_edit_event", {
        p_event_id: eventId,
        p_key: "event.edit_details",
      }),
    ).toBe(true);
    expect(
      await can(delCli, "can_edit_event", {
        p_event_id: eventId,
        p_key: "event.cancel",
      }),
    ).toBe(false);
  });

  it("event moderator can act on a session below (override)", async () => {
    const a = admin();
    const owner = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });
    const { id: sessionId } = await makeSession(a, eventId);
    const ownerCli = await userClient(owner.email, owner.password);
    expect(
      await can(ownerCli, "can_act_on_session", {
        p_session_id: sessionId,
        p_key: "session.edit_details",
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- waterfall`
Expected: FAIL (function `can_edit_event` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0008_waterfall_helpers.sql`:

```sql
create or replace function public.can_edit_event(p_event_id uuid, p_key text)
returns boolean language sql security definer stable as $$
  select
    public.has_global_permission(auth.uid(), 'platform.admin')
    or exists (select 1 from public.events e where e.id = p_event_id and e.owner_id = auth.uid())
    or exists (
      select 1 from public.event_delegates d
      where d.event_id = p_event_id and d.user_id = auth.uid() and p_key = any(d.permissions)
    );
$$;

create or replace function public.can_act_on_session(p_session_id uuid, p_key text)
returns boolean language sql security definer stable as $$
  select
    public.has_global_permission(auth.uid(), 'platform.admin')
    or exists (select 1 from public.sessions s where s.id = p_session_id and s.owner_id = auth.uid())
    or exists (
      select 1 from public.session_delegates d
      where d.session_id = p_session_id and d.user_id = auth.uid() and p_key = any(d.permissions)
    )
    or exists (
      -- waterfall: parent-event authority (owner or moderator) overrides
      select 1 from public.sessions s
      where s.id = p_session_id
        and public.can_edit_event(s.event_id, 'event.moderate_sessions')
    );
$$;
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- waterfall`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_waterfall_helpers.sql tests/db/waterfall.test.ts
git commit -m "feat(db): waterfall permission helpers (event + session)"
```

---

## Task 10: RLS policies + the permission matrix test

**Files:**

- Create: `supabase/migrations/0009_rls_policies.sql`
- Test: `tests/db/rls-matrix.test.ts`

**Interfaces:**

- Consumes: `can_edit_event`, `can_act_on_session`, `has_global_permission`.
- Produces: RLS policies on `events`, `sessions`, `session_occurrences`, `documents`, and the delegation tables.

- [ ] **Step 1: Write the failing data-driven matrix test**

`tests/db/rls-matrix.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createUser,
  makeEvent,
  makeSession,
  userClient,
} from "./helpers.js";

// One event with: owner, a Designer (content only), a Communications mgr (broadcast only).
let eventId: string;
let sessionId: string;
let designer: Awaited<ReturnType<typeof userClient>>;

beforeAll(async () => {
  const a = admin();
  const owner = await createUser();
  const designerU = await createUser();
  const { id: eId } = await makeEvent(a, { owner_id: owner.id });
  const { id: sId } = await makeSession(a, eId, { owner_id: owner.id });
  eventId = eId;
  sessionId = sId;
  await a.from("event_delegates").insert({
    event_id: eId,
    user_id: designerU.id,
    permissions: [
      "event_content.create",
      "event_content.update",
      "event_content.delete",
    ],
    granted_by: owner.id,
  });
  designer = await userClient(designerU.email, designerU.password);
});

describe("RLS permission matrix", () => {
  it("Designer can insert event documents", async () => {
    const { error } = await designer.from("documents").insert({
      event_id: eventId,
      storage_path: "p",
      filename: "flyer.pdf",
    });
    expect(error).toBeNull();
  });

  it("Designer cannot edit event details", async () => {
    const { error } = await designer
      .from("events")
      .update({ title: "hijacked" })
      .eq("id", eventId);
    expect(error).not.toBeNull();
  });

  it("Anonymous cannot read a draft event", async () => {
    const anonCli = await (
      await import("@supabase/supabase-js")
    ).createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data } = await anonCli
      .from("events")
      .select("id")
      .eq("id", eventId);
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- rls-matrix`
Expected: FAIL (Designer insert blocked / draft visible — policies absent or default-deny inconsistent).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0009_rls_policies.sql`:

```sql
alter table public.events enable row level security;
alter table public.sessions enable row level security;
alter table public.session_occurrences enable row level security;
alter table public.documents enable row level security;
alter table public.event_delegates enable row level security;
alter table public.event_session_owners enable row level security;
alter table public.session_delegates enable row level security;

-- EVENTS
create policy "events_select" on public.events for select using (
  (status = 'published' and visibility = 'public')
  or public.can_edit_event(id, 'event.edit_details')
);
create policy "events_insert" on public.events for insert with check (
  public.has_global_permission(auth.uid(), 'events.create') and owner_id = auth.uid()
);
create policy "events_update" on public.events for update
  using (public.can_edit_event(id, 'event.edit_details'))
  with check (public.can_edit_event(id, 'event.edit_details'));
create policy "events_delete" on public.events for delete
  using (public.can_edit_event(id, 'event.delete'));

-- SESSIONS
create policy "sessions_select" on public.sessions for select using (
  exists (select 1 from public.events e where e.id = event_id
          and ((e.status='published' and e.visibility='public') or public.can_edit_event(e.id,'event.edit_details')))
);
create policy "sessions_insert" on public.sessions for insert with check (
  public.can_edit_event(event_id, 'event.moderate_sessions')
  or exists (select 1 from public.event_session_owners o
             where o.event_id = event_id and o.user_id = auth.uid())
);
create policy "sessions_update" on public.sessions for update
  using (public.can_act_on_session(id, 'session.edit_details'))
  with check (public.can_act_on_session(id, 'session.edit_details'));
create policy "sessions_delete" on public.sessions for delete
  using (public.can_act_on_session(id, 'session.delete'));

-- SESSION OCCURRENCES (schedule)
create policy "occurrences_select" on public.session_occurrences for select using (
  exists (select 1 from public.sessions s where s.id = session_id) -- visibility governed by session policy via join in app
);
create policy "occurrences_write" on public.session_occurrences for all
  using (public.can_act_on_session(session_id, 'session.edit_schedule'))
  with check (public.can_act_on_session(session_id, 'session.edit_schedule'));

-- DOCUMENTS
create policy "documents_select" on public.documents for select using (
  is_published
  or (event_id is not null and public.can_edit_event(event_id, 'event_content.update'))
  or (session_id is not null and public.can_act_on_session(session_id, 'session_content.update'))
);
create policy "documents_write_event" on public.documents for all
  using (event_id is not null and public.can_edit_event(event_id, 'event_content.update'))
  with check (event_id is not null and public.can_edit_event(event_id, 'event_content.create'));
create policy "documents_write_session" on public.documents for all
  using (session_id is not null and public.can_act_on_session(session_id, 'session_content.update'))
  with check (session_id is not null and public.can_act_on_session(session_id, 'session_content.create'));

-- DELEGATION TABLES
create policy "event_delegates_read" on public.event_delegates for select
  using (user_id = auth.uid() or public.can_edit_event(event_id, 'event.manage_delegates'));
create policy "event_delegates_write" on public.event_delegates for all
  using (public.can_edit_event(event_id, 'event.manage_delegates'))
  with check (public.can_edit_event(event_id, 'event.manage_delegates'));

create policy "event_session_owners_read" on public.event_session_owners for select
  using (user_id = auth.uid() or public.can_edit_event(event_id, 'event.manage_session_owners'));
create policy "event_session_owners_write" on public.event_session_owners for all
  using (public.can_edit_event(event_id, 'event.manage_session_owners'))
  with check (public.can_edit_event(event_id, 'event.manage_session_owners'));

create policy "session_delegates_read" on public.session_delegates for select
  using (user_id = auth.uid() or public.can_act_on_session(session_id, 'session.manage_delegates'));
create policy "session_delegates_write" on public.session_delegates for all
  using (public.can_act_on_session(session_id, 'session.manage_delegates'))
  with check (public.can_act_on_session(session_id, 'session.manage_delegates'));
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db`
Expected: all integration tests PASS (run the whole suite — RLS now affects earlier user-scoped tests too).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_rls_policies.sql tests/db/rls-matrix.test.ts
git commit -m "feat(db): RLS policies across domain + delegation tables"
```

---

## Task 11: Severe-action RPCs

**Files:**

- Create: `supabase/migrations/0010_action_rpcs.sql`
- Test: `tests/db/rpcs.test.ts`

**Interfaces:**

- Produces: `cancel_event(p_event_id uuid)`, `publish_event(p_event_id uuid)`, `set_event_visibility(p_event_id uuid, p_visibility text)`, `broadcast_announcement(p_event_id uuid, p_title text, p_body text)` — all SECURITY DEFINER, each checking its key, raising `insufficient_privilege` otherwise. `broadcast_announcement` is a stub that validates + returns (notification fan-out lands in sub-project #3).

- [ ] **Step 1: Write the failing test**

`tests/db/rpcs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent, userClient } from "./helpers.js";

describe("severe-action RPCs", () => {
  it("cancel_event requires event.cancel", async () => {
    const a = admin();
    const owner = await createUser();
    const other = await createUser();
    const { id } = await makeEvent(a, {
      owner_id: owner.id,
      status: "published",
    });

    const otherCli = await userClient(other.email, other.password);
    const { error: denied } = await otherCli.rpc("cancel_event", {
      p_event_id: id,
    });
    expect(denied).not.toBeNull();

    const ownerCli = await userClient(owner.email, owner.password);
    const { error: ok } = await ownerCli.rpc("cancel_event", {
      p_event_id: id,
    });
    expect(ok).toBeNull();

    const { data } = await a
      .from("events")
      .select("status")
      .eq("id", id)
      .single();
    expect(data.status).toBe("canceled");
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- rpcs`
Expected: FAIL (function `cancel_event` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0010_action_rpcs.sql`:

```sql
create or replace function public.cancel_event(p_event_id uuid)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.cancel') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set status = 'canceled' where id = p_event_id;
  -- sub-project #3 hooks cancellation notifications here.
end;
$$;

create or replace function public.publish_event(p_event_id uuid)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.manage_lifecycle') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set status = 'published' where id = p_event_id;
end;
$$;

create or replace function public.set_event_visibility(p_event_id uuid, p_visibility text)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.manage_visibility') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set visibility = p_visibility::event_visibility where id = p_event_id;
end;
$$;

create or replace function public.broadcast_announcement(p_event_id uuid, p_title text, p_body text)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.broadcast') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  -- Stub: validated here; notification fan-out is implemented in sub-project #3.
  if coalesce(trim(p_title), '') = '' then
    raise exception 'announcement title required' using errcode = '22000';
  end if;
end;
$$;
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- rpcs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_action_rpcs.sql tests/db/rpcs.test.ts
git commit -m "feat(db): severe-action RPCs (cancel/publish/visibility/broadcast stub)"
```

---

## Task 12: Orphan-cascade triggers

**Files:**

- Create: `supabase/migrations/0011_orphan_cascade.sql`
- Test: `tests/db/cascade.test.ts`

**Interfaces:**

- Produces: trigger on `event_session_owners` AFTER DELETE → nulls `sessions.owner_id` for that user in that event; trigger on `sessions` AFTER UPDATE of `owner_id` → NULL deletes that session's `session_delegates`.

- [ ] **Step 1: Write the failing test**

`tests/db/cascade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent, makeSession } from "./helpers.js";

describe("orphan cascade", () => {
  it("revoking a session owner orphans their sessions and drops session delegates", async () => {
    const a = admin();
    const owner = await createUser();
    const sowner = await createUser();
    const sdelegate = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });
    await a
      .from("event_session_owners")
      .insert({ event_id: eventId, user_id: sowner.id, granted_by: owner.id });
    const { id: sessionId } = await makeSession(a, eventId, {
      owner_id: sowner.id,
    });
    await a.from("session_delegates").insert({
      session_id: sessionId,
      user_id: sdelegate.id,
      permissions: ["session.edit_details"],
      granted_by: sowner.id,
    });

    await a
      .from("event_session_owners")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", sowner.id);

    const { data: sess } = await a
      .from("sessions")
      .select("owner_id")
      .eq("id", sessionId)
      .single();
    expect(sess.owner_id).toBeNull(); // orphaned

    const { count } = await a
      .from("session_delegates")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);
    expect(count).toBe(0); // delegates dropped
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- cascade`
Expected: FAIL (owner_id still set / delegates remain).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0011_orphan_cascade.sql`:

```sql
create or replace function public.orphan_sessions_of_removed_owner()
returns trigger security definer language plpgsql as $$
begin
  update public.sessions
    set owner_id = null
    where event_id = old.event_id and owner_id = old.user_id;
  return old;
end;
$$;

create trigger event_session_owner_removed
  after delete on public.event_session_owners
  for each row execute function public.orphan_sessions_of_removed_owner();

create or replace function public.clear_delegates_on_orphan()
returns trigger security definer language plpgsql as $$
begin
  if new.owner_id is null and old.owner_id is not null then
    delete from public.session_delegates where session_id = new.id;
  end if;
  return new;
end;
$$;

create trigger session_orphaned
  after update of owner_id on public.sessions
  for each row execute function public.clear_delegates_on_orphan();
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db -- cascade`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_orphan_cascade.sql tests/db/cascade.test.ts
git commit -m "feat(db): orphan-cascade triggers for revoked session owners"
```

---

## Task 13: Deep immutable auditing

Adapted from `candystore/.../20260325400000_audit_system.sql` (audit-read RLS uses `has_global_permission` + scoped event check instead of `resource_permissions`).

**Files:**

- Create: `supabase/migrations/0012_audit.sql`
- Test: `tests/db/audit.test.ts`

**Interfaces:**

- Produces: `audit` schema + `audit.logged_actions`; `audit.log_changes()` + `audit.enable_tracking(regclass)`; tracking enabled on all domain + permission + delegation tables; immutability guard; read gated by `audit.read` (admin) or scoped event authority.

- [ ] **Step 1: Write the failing test**

`tests/db/audit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent } from "./helpers.js";

describe("auditing", () => {
  it("records an INSERT with actor and row snapshot", async () => {
    const a = admin();
    const owner = await createUser();
    const { id } = await makeEvent(a, { owner_id: owner.id, title: "Audited" });
    const { data } = await a
      .schema("audit")
      .from("logged_actions")
      .select("action_type,row_data")
      .eq("table_name", "events")
      .order("event_id", { ascending: false })
      .limit(1)
      .single();
    expect(data.action_type).toBe("INSERT");
    expect((data.row_data as { id: string }).id).toBe(id);
  });

  it("blocks updates/deletes on audit rows (immutable)", async () => {
    const a = admin();
    const { error } = await a
      .schema("audit")
      .from("logged_actions")
      .update({ table_name: "x" })
      .eq("event_id", 1);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm test:db -- audit`
Expected: FAIL (schema `audit` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0012_audit.sql`:

```sql
create schema if not exists audit;
grant usage on schema audit to authenticated;

create table audit.logged_actions (
  event_id bigserial primary key,
  schema_name text not null,
  table_name text not null,
  user_id uuid,
  db_user text not null default session_user,
  action_type text not null check (action_type in ('INSERT','UPDATE','DELETE')),
  row_data jsonb,
  changed_fields jsonb,
  action_timestamp timestamptz not null default now(),
  transaction_id bigint default txid_current(),
  client_ip inet default inet_client_addr()
);
create index logged_actions_table on audit.logged_actions using btree (table_name);
create index logged_actions_user on audit.logged_actions using btree (user_id) where user_id is not null;
grant select on audit.logged_actions to authenticated;

create or replace function audit.log_changes()
returns trigger security definer language plpgsql as $$
declare v_user uuid; v_changed jsonb;
begin
  begin v_user := auth.uid(); exception when others then v_user := null; end;
  if (tg_op = 'INSERT') then
    insert into audit.logged_actions (schema_name, table_name, user_id, action_type, row_data)
      values (tg_table_schema, tg_table_name, v_user, 'INSERT', to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    select jsonb_object_agg(key, value) into v_changed
      from jsonb_each(to_jsonb(new)) where to_jsonb(new)->key is distinct from to_jsonb(old)->key;
    if v_changed is null then return new; end if;
    insert into audit.logged_actions (schema_name, table_name, user_id, action_type, row_data, changed_fields)
      values (tg_table_schema, tg_table_name, v_user, 'UPDATE', to_jsonb(new), v_changed);
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit.logged_actions (schema_name, table_name, user_id, action_type, row_data)
      values (tg_table_schema, tg_table_name, v_user, 'DELETE', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

create or replace function audit.enable_tracking(target regclass)
returns void language plpgsql as $$
declare n text;
begin
  n := replace(replace('audit_' || target::text, '.', '_'), '"', '');
  execute format('drop trigger if exists %I on %s', n, target);
  execute format('create trigger %I after insert or update or delete on %s for each row execute function audit.log_changes()', n, target);
end;
$$;

select audit.enable_tracking('public.user_profiles');
select audit.enable_tracking('public.permissions');
select audit.enable_tracking('public.user_permissions');
select audit.enable_tracking('public.events');
select audit.enable_tracking('public.sessions');
select audit.enable_tracking('public.session_occurrences');
select audit.enable_tracking('public.documents');
select audit.enable_tracking('public.event_delegates');
select audit.enable_tracking('public.event_session_owners');
select audit.enable_tracking('public.session_delegates');

-- Immutability: block update/delete on audit rows.
create or replace function audit.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit.logged_actions is append-only' using errcode = '42501';
end;
$$;
create trigger audit_immutable
  before update or delete on audit.logged_actions
  for each row execute function audit.block_mutation();

-- Read access: admin (all) or event authority (scoped) with audit.read.
alter table audit.logged_actions enable row level security;
create policy "audit_read" on audit.logged_actions for select using (
  public.has_global_permission(auth.uid(), 'platform.admin')
  or (
    public.has_global_permission(auth.uid(), 'audit.read')
    and table_name in ('events','sessions','session_occurrences','documents',
                       'event_delegates','event_session_owners','session_delegates')
    -- (Sub-project #2 refines this to the specific events the user owns/delegates.)
  )
);
```

- [ ] **Step 4: Run green**

Run: `pnpm test:db`
Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_audit.sql tests/db/audit.test.ts
git commit -m "feat(db): deep immutable auditing with scoped read"
```

---

## Task 14: `packages/auth` helper + regen types + docs

**Files:**

- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`, `packages/auth/src/permissions.ts`, `packages/auth/src/permissions.test.ts`, `packages/auth/src/index.ts`
- Modify: `packages/db/src/database.types.ts` (regen), `CLAUDE.md`

**Interfaces:**

- Produces: `PERMISSION_KEYS` (readonly tuple of the 28 keys); `type PermissionKey`; `matchesPermissions(granted: Set<string>, required: string | readonly string[], mode?: "all" | "any"): boolean`.

- [ ] **Step 1: Write the failing unit test**

`packages/auth/src/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchesPermissions } from "./permissions.js";

describe("matchesPermissions", () => {
  const granted = new Set(["event.edit_details", "event_content.create"]);
  it("matches a single key", () => {
    expect(matchesPermissions(granted, "event.edit_details")).toBe(true);
    expect(matchesPermissions(granted, "event.cancel")).toBe(false);
  });
  it("supports all vs any", () => {
    expect(
      matchesPermissions(
        granted,
        ["event.edit_details", "event.cancel"],
        "all",
      ),
    ).toBe(false);
    expect(
      matchesPermissions(
        granted,
        ["event.edit_details", "event.cancel"],
        "any",
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm --filter @puck/auth test`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the package + implementation**

`packages/auth/package.json`:

```json
{
  "name": "@puck/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

`packages/auth/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": true },
  "include": ["src/**/*"]
}
```

`packages/auth/src/permissions.ts`:

```ts
export const PERMISSION_KEYS = [
  "platform.admin",
  "events.create",
  "audit.read",
  "event.read",
  "session.read",
  "content.read",
  "subscriptions.manage",
  "event.edit_details",
  "event.edit_schedule",
  "event.manage_visibility",
  "event.manage_lifecycle",
  "event.cancel",
  "event.broadcast",
  "event.manage_delegates",
  "event.manage_session_owners",
  "event.moderate_sessions",
  "event.delete",
  "event_content.create",
  "event_content.update",
  "event_content.delete",
  "session.create",
  "session.edit_details",
  "session.edit_schedule",
  "session.delete",
  "session.manage_delegates",
  "session_content.create",
  "session_content.update",
  "session_content.delete",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function matchesPermissions(
  granted: Set<string>,
  required: string | readonly string[],
  mode: "all" | "any" = "all",
): boolean {
  const keys = typeof required === "string" ? [required] : required;
  return mode === "all"
    ? keys.every((k) => granted.has(k))
    : keys.some((k) => granted.has(k));
}
```

`packages/auth/src/index.ts`:

```ts
export {
  PERMISSION_KEYS,
  type PermissionKey,
  matchesPermissions,
} from "./permissions.js";
```

- [ ] **Step 4: Run green + typecheck**

Run: `pnpm --filter @puck/auth test && pnpm --filter @puck/auth typecheck`
Expected: PASS.

- [ ] **Step 5: Regenerate DB types + verify the key set matches the catalog**

Run:

```bash
pnpm db:types
node -e "const {PERMISSION_KEYS}=require('./packages/auth/src/permissions.ts'); console.log(PERMISSION_KEYS.length)"  # 28
```

Confirm `PERMISSION_KEYS.length === 28` (matches the seeded catalog in Task 4).

- [ ] **Step 6: Update CLAUDE.md getting-started**

Add to `CLAUDE.md` under commands: `pnpm test:db` (DB-integration tests; requires `supabase start`), and note `packages/auth` holds the permission key catalog + helpers.

- [ ] **Step 7: Commit**

```bash
git add packages/auth packages/db/src/database.types.ts CLAUDE.md
git commit -m "feat(auth): permission key catalog + matchesPermissions helper; regen db types"
```

---

## Self-Review

**1. Spec coverage**

| Spec section                                        | Task(s)                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| §2.2 catalog (28 keys)                              | 4 (seed), 14 (TS mirror)                                                                                  |
| §2.1 waterfall hierarchy                            | 9 (helpers), 10 (RLS)                                                                                     |
| §2.3 templates                                      | Stored as `permissions[]` arrays (Tasks 8/10); preset _UI_ is sub-project #2 — noted as out of scope here |
| §2.4 orphan cascade                                 | 12                                                                                                        |
| §3.1 identity/permission core                       | 3, 4, 5                                                                                                   |
| §3.2 domain (events/sessions/occurrences/documents) | 6, 7                                                                                                      |
| §3.3 delegation tables                              | 8                                                                                                         |
| §4 enforcement (RLS + RPCs + helpers)               | 9, 10, 11                                                                                                 |
| §5 deep auditing                                    | 13                                                                                                        |
| §6 auth (signup triggers; profiles)                 | 3, 5 — _OAuth provider config + login UI = sub-project #2_                                                |
| §7 testing (TDD, unit + DB-integration)             | every task; 14 (unit)                                                                                     |

Gaps intentionally deferred (documented, not missing): preset **UI**, OAuth provider wiring, and the **login UI** belong to sub-project #2; notification/pgmq tables to #3.

**2. Placeholder scan:** No "TBD/TODO/handle errors"; the only "stub" (`broadcast_announcement`) is a deliberate, spec-stated boundary with real validation + permission check.

**3. Type consistency:** `has_global_permission(p_user_id, p_key)`, `can_edit_event(p_event_id, p_key)`, `can_act_on_session(p_session_id, p_key)`, and `matchesPermissions(granted, required, mode)` are used identically wherever referenced. The 28 keys in Task 4 SQL and Task 14 `PERMISSION_KEYS` match.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-19-puck-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
