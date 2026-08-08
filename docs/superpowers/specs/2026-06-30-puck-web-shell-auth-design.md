# Puck — Sub-project #2: Authoring Web App (`apps/web`) — Slice 1: App Shell + Auth + Account — Design

- **Date:** 2026-06-30
- **Status:** Approved for implementation planning
- **Scope:** Sub-project #2 of the Puck platform (see `docs/2026-06-19-platform-roadmap.md`). This spec details **Slice 1** in full and documents the **6-slice #2 roadmap** that the GitHub epic tracks.
- **Author:** Heiner Angarita (with Claude)
- **Builds on:** Sub-project #1 Foundation (merged to `develop`, `e9d9409`) — identity, 28-key RBAC, events/sessions/occurrences/documents schema, two-level delegation, RLS, severe-action RPCs, deep auditing, `@puck/auth` + `@puck/db`.
- **Design system:** `docs/design/README.md` (binding visual guidelines — iris/indigo brand, functional color, tabular times).

## 1. Context & goal

Sub-project #2 is Puck's **organizer-facing authoring web app** (`apps/web`): a Next.js
App Router app where organizers create/edit events & sessions, view a per-day
schedule, configure recurrence, upload support content, and manage delegates. It
is Puck's **first `apps/*`**, so Slice 1 also establishes the app architecture that
every later slice inherits.

It talks **directly to Supabase** (the Postgres + Auth + RLS + RPCs the foundation
built) — there is no REST/API indirection for authoring. The Fastify API + worker
remain reserved for sub-project #3 (notification engine).

### Form factor

Responsive, **equal desktop + mobile weight** (no primary target). It reuses the
design tokens from `docs/design/README.md` (brand, color, type) for visual
consistency with the rest of Puck, but its **layout is an authoring surface**
(nav + forms + data views), not the phone-first consumer timetable (which belongs
to #3/#4).

## 2. The #2 slice roadmap (the GitHub epic's children)

#2 lands incrementally as independently-shippable slices. Each slice is one
GitHub child issue → `feat/GH-N_…` branch → PR (`Closes #N`) → squash-merge to
`develop` → checked off in the epic.

| #     | Slice (→ child issue)                        | Delivers                                                                                                                                                                                                      |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **App shell + auth + account** _(this spec)_ | `apps/web` scaffold, Google/Discord OAuth login, protected responsive shell wired to design tokens + i18n, and an Account page that reads/edits `user_profiles` under RLS. Proves the whole stack end-to-end. |
| 2     | Event authoring                              | List / create / edit events; settings (details, schedule, visibility); publish & cancel via the foundation RPCs; gated on `events.create` + RLS.                                                              |
| 3     | Session authoring + per-day view             | Sessions under an event; the per-day schedule reading `session_occurrences`; session create/edit.                                                                                                             |
| 4     | Recurrence                                   | Recurring sessions → generating multiple occurrences + editing UI.                                                                                                                                            |
| 5     | Documents / uploads                          | Support-content upload to Supabase Storage for events/sessions + the publish toggle.                                                                                                                          |
| 6     | Delegates & permissions UI                   | Manage event delegates, session owners, session delegates over the 28-key catalog + presets.                                                                                                                  |

Slices 2–6 are **out of scope for this spec** — each gets its own spec → plan →
implementation cycle.

## 3. Slice 1 — scope & Definition of Done

**In scope:** the `apps/web` project skeleton; `packages/ui` introduction
(shadcn/ui); Google + Discord OAuth login (social-only, no passwords); server-side
sessions + middleware route protection; a responsive app shell wired to the design
tokens + i18n; an **Account page** that displays the session email (read-only) and
reads/edits `display_name` + `avatar_url` on `user_profiles` under RLS; sign-out;
the test harness (Vitest + RTL + MSW unit tests, Playwright E2E, axe a11y).

**Definition of done:**

1. A new user can log in with Google or Discord; first login auto-provisions their
   `user_profiles` row + default consumer permissions (via the foundation triggers).
2. Unauthenticated access to any `(app)` route redirects to `/login`.
3. The Account page renders responsively, shows the session email read-only, and
   lets the user edit `display_name` + `avatar_url` (persisted under RLS).
4. Sign-out returns to `/login`.
5. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (unit), and the
   slice-1 Playwright E2E all pass; new env vars documented in `.env.example` + README.

## 4. Architecture

Follows `.claude/rules/architecture.md` + `monorepo-architecture.md`. This **is the
Libra monorepo pattern** — same pnpm `apps/*` + `packages/*` layout, the same
clean-architecture feature/layer structure (`features/[feature]/{domain,application,infrastructure,presentation}`),
and the same `packages/ui` / `packages/auth` split. Slice 1 mirrors Libra's own
Supabase-backed account feature (e.g. Libra `apps/auth/src/features/account/infrastructure/profileQueries.ts`).

```
apps/web/src/
├── app/
│   ├── (auth)/login/page.tsx          # public OAuth login
│   ├── auth/callback/route.ts         # OAuth code → session exchange
│   ├── (app)/
│   │   ├── layout.tsx                 # protected app shell (nav + providers)
│   │   └── account/page.tsx           # thin wrapper → AccountPage feature
│   └── layout.tsx                     # root layout (html, fonts, globals.css)
├── features/account/
│   ├── domain/            # Profile type (from @puck/db), zod schema, constants
│   ├── application/       # useProfile, useUpdateProfile (TanStack Query)
│   ├── infrastructure/    # profileQueries.ts (Supabase select/update)
│   └── presentation/      # AccountPage, ProfileForm
├── shared/
│   ├── infrastructure/
│   │   ├── supabase/      # browser-client.ts, server-client.ts (@supabase/ssr)
│   │   ├── i18n/          # next-intl: messages/{en,es}.json, routing, request
│   │   └── config/        # env (zod-validated), tid()
│   └── presentation/      # AppShell, Nav, providers (TanStack Query, theme)
├── middleware.ts          # @supabase/ssr session refresh + (app) route guard
└── mocks/                 # MSW handlers + server (tests)
```

**Stack (mirror Libra/Janus; deviations noted):** Next.js 16 App Router,
Tailwind v4 + shadcn/ui (`packages/ui`), `next-intl` (locales **en + es**),
`@supabase/ssr`, TanStack Query, Vitest + RTL + MSW + Playwright. Consumes
`@puck/db` (types) and `@puck/auth` (`matchesPermissions`, 28-key catalog).

**Deliberate divergence from `architecture.md` — no orval:** that rule (ported from
a REST-API project) assumes an orval-generated API client in the infrastructure
layer. Puck #2 talks **directly to Supabase**, so feature `infrastructure/` wraps
Supabase queries typed by `@puck/db` (TanStack Query for client cache) — **not
orval**. This matches how Libra implements its own Supabase features. Orval
(`orval.config.ts`, already templated) stays unused until #3's Fastify API.

**Data access:** reads via Server Components / the server Supabase client where
possible; mutations via Server Actions or client mutations using the browser
client; both honour the session cookie so RLS runs as the signed-in user. RLS +
the foundation's grants are the authority — the app never bypasses them
(service-role is never shipped to the client).

**Design-system wiring:** `globals.css` authors the `docs/design/README.md` tokens
as OKLCH CSS variables (per `tailwind.md` / `single-source-of-truth.md`), with the
`@source` directive scanning `packages/ui` (per `css-consistency.md`). `packages/ui`
components carry **no i18n** — labels are injected as props (per `monorepo-architecture.md`).

## 5. Auth flow (social-only)

- **`/login`** (public) renders **"Continue with Google" / "Continue with Discord"**
  buttons → `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: <origin>/auth/callback } })`.
- **`/auth/callback/route.ts`** exchanges the OAuth `code` for a session
  (`exchangeCodeForSession`), persists it as cookies via `@supabase/ssr`, and
  redirects to the post-login destination (default `/account`).
- **`middleware.ts`** runs the `@supabase/ssr` session refresh on every request and
  **guards the `(app)` group**: no session → redirect to `/login` (preserving the
  intended path). Sign-out is a Server Action calling `supabase.auth.signOut()` and
  clearing cookies, then redirecting to `/login`.
- **Two Supabase clients** in `shared/infrastructure/supabase/`: a **browser** client
  (client components) and a **server** client bound to request cookies (Server
  Components / Actions / route handlers / middleware).

**Foundation integration (the end-to-end proof):** first OAuth login inserts an
`auth.users` row → the foundation's `sync_user_profile` trigger creates the
`user_profiles` row → the default-consumer-permissions trigger grants
`event.read`, `session.read`, `content.read`, `subscriptions.manage`. Slice 1
exercises this real wiring rather than mocking it.

**Provider config:** Google + Discord are configured in `supabase/config.toml`
(local) with `localhost` redirect URIs; client IDs/secrets come from
`.env`/`.secrets`, never committed. (Documenting/finishing local provider config is
part of slice 1.)

**Prerequisite (user-provided):** real **Google + Discord OAuth app credentials**
(client ID + secret) are needed to manually exercise login end-to-end (create the
OAuth apps; add `http://localhost:54321/auth/v1/callback` + the app's
`/auth/callback` as authorized redirect URIs). The automated **E2E does not need
them** — it uses programmatically-seeded sessions (§8). So slice 1 can be built and
CI-verified without the credentials; only manual "click Sign in with Google"
verification is blocked until they're provided. This is the #2 analogue of the
Docker/Supabase setup from #1.

## 6. Account feature

**Email comes from the session, not `user_profiles`.** The foundation's PII
hardening (`0013`) column-scopes `user_profiles` SELECT so even an authenticated
user cannot read `email`/`provider` from the table. Therefore the Account page reads
**email read-only from the auth session** (`supabase.auth.getUser().email`) and
reads/edits **`display_name` + `avatar_url` from `user_profiles`** (RLS
`profiles_update_own`).

- **`domain/`** — `Profile` type derived from `@puck/db` `Database` types; a zod
  schema (`display_name`: non-empty, bounded length; `avatar_url`: optional URL);
  field constants.
- **`infrastructure/profileQueries.ts`** — `getProfile()` (select
  `id, display_name, avatar_url` for `auth.uid()`), `updateProfile(patch)` (update
  the two editable columns; RLS enforces own-row). Typed by `@puck/db`.
- **`application/`** — `useProfile()` / `useUpdateProfile()` **client-side TanStack
  Query hooks** (browser client), mirroring Libra's account feature. (§4's
  general principle prefers RSC reads where they help, but slice 1's account is small
  and interactive, so it uses client hooks throughout — this is the authoritative
  choice for the account feature.)
- **`presentation/`** — `AccountPage` (session email read-only, sign-out) +
  `ProfileForm` (react-hook-form + zod; responsive).

## 7. Responsive shell + i18n

- **Shell:** a responsive `AppShell` (`(app)/layout.tsx`) — top bar + nav that adapts
  desktop ↔ mobile, themed by the design tokens, brand = iris. For slice 1 the only
  nav destination is **Account** (later slices add Events, etc.). Skeleton/loading
  - empty/error states from the start.
- **i18n:** `next-intl` with `messages/en.json` + `messages/es.json`. **No hardcoded
  user-facing strings** — every key exists in both locales (per
  `single-source-of-truth.md`). The shell, login, and account copy follow the design
  guidelines' voice (Puck speaks in the first person where it fits).

## 8. Testing (TDD)

- **Unit (Vitest + RTL + MSW):** `ProfileForm` (render, zod validation, submit);
  `useProfile`/`useUpdateProfile` against **MSW-mocked Supabase**; OAuth buttons
  (assert `signInWithOAuth` called with the right provider + `redirectTo`); the
  sign-out action. Selectors prefer `tid()` (per `e2e-selectors.md`).
- **E2E (Playwright):** OAuth is **not** clicked through real providers in CI.
  Instead: (a) unauthenticated `/account` → redirects to `/login` (proves
  middleware); (b) with a **programmatically-seeded session** (create a test user via
  service role, sign in for tokens, set the auth cookies), the Account page loads,
  shows the session email, and edits `display_name`. Plus axe a11y on `/login` +
  `/account`. No `toContainText`/`toHaveText` on translated copy (per
  `e2e-selectors.md`).
- **Discipline:** TDD throughout (write the failing test first). Core logic tested
  with MSW fakes — no real network. Coverage of loading / empty / error states.

## 9. GitHub-tasks workflow (epic + per-slice)

This is the issue-driven flow we adopt starting with #2:

1. **Epic issue** — _"#2 — Authoring web app (`apps/web`)"_ — a tracking issue with
   the 6-slice checklist + a link to this spec. Stays open through all of #2.
2. **Slice-1 issue** — _"Slice 1: app shell + auth + account page"_ — linked to the
   epic; carries this slice's Definition of Done.
3. Branch **`feat/GH-<slice1#>_App-Shell-Auth`** off `develop` → writing-plans →
   subagent-driven execution → PR **`Closes #<slice1#>`** (+ epic reference) →
   squash-merge to `develop` (the documented develop strategy) → check slice 1 off
   in the epic.
4. Repeat per slice. Each child issue is its own branch / PR / merge.

Issue creation is outward-facing, so it happens **only with explicit user
confirmation** at the start of execution. This spec is committed as the first commit
on the slice-1 branch (develop is protected — no direct commits).

## 10. Non-goals (deferred)

- **Slices 2–6** (events, sessions, per-day view, recurrence, uploads, delegates) —
  separate specs.
- **Orval / Fastify API** — returns with #3 (notification engine).
- **The consumer phone-first timetable / now-next board** — that's the #3/#4 surface,
  not the authoring app.
- **Notification logic, subscriptions, Telegram/email** — #3/#4.
- **Email editing** — email is an identity field owned by the auth provider; the
  account page shows it read-only and does not change it.

## 11. Resolved decisions

- **Locales:** ship **en + es** from slice 1 (mirrors Libra; i18n infra makes
  adding more cheap).
- **Data access:** direct Supabase (no orval) — §4.
- **Email source:** auth session, not `user_profiles` — §6.
- **Auth providers:** Google + Discord only (social-only, no passwords).
- **Form factor:** responsive, equal desktop + mobile weight — §1.
