# E2E in CI — Dockerized app + Dockerized Supabase

**Date:** 2026-07-16
**Status:** Design approved (pending written-spec review)
**Issue:** GH-4 (Sub-project #2 — authoring web app / CI hardening)
**Branch:** `chore/GH-4_E2E-In-CI`

## Problem

Puck has a Playwright E2E suite (`apps/web/e2e/` — protected-redirect, seeded-session
account edit, axe a11y) but **nothing runs it in CI**. It only executes when a developer
manually runs it locally against a running Supabase. Every bug the suite is designed to
catch — the middleware/proxy regressions that broke `next build` + hydration — reached
`develop` invisibly and was only found by running E2E by hand afterward.

This design wires E2E into CI using the **CandyStore container model** (chosen over a
lighter runner-only approach): CI builds a production-style standalone Docker image of
the web app served behind nginx, boots a real local Supabase stack, and runs Playwright
against the built container. This is production-shaped and scales cleanly when
`apps/api` / `apps/worker` / `apps/bot` land.

## Decisions (locked)

1. **Container model** (not runner-only `next start`): build a standalone image via
   `docker/ci/Dockerfile`, serve behind nginx + supervisord on `:8080`, run E2E against it.
2. **Demo keys as literals** (no GitHub secrets): a local Supabase (`supabase start`)
   always boots with the well-known public demo anon/service-role keys. `.env.ci` and the
   image build-args use those literals directly. No repo-secret setup; works on forks.
3. **E2E is merge-blocking**: the `e2e-tests` job is added to the `CI Gate` aggregator's
   `needs`, so a failure blocks merge. Mitigated by `retries: 2` (CI) and `--max-failures=1`.

## Architecture

### Topology (CI)

```
GitHub Actions runner (ubuntu, Linux)
├── Supabase CLI stack (host)         supabase start → Postgres+Auth on :54321
│     (demo JWT secret → demo anon/service keys; migrations applied on boot)
├── App container  puck-ci            docker compose up → nginx :8080 → host :5050
│     └── nginx → web (Next standalone) :5000
│           server-side Supabase calls → host.docker.internal:54321  (INTERNAL url)
└── Playwright (host chromium)        baseURL http://localhost:5050
      ├── admin API (service key) → localhost:54321   (create/delete test user)
      └── browser → localhost:5050 (container) ; browser Supabase → localhost:54321
```

### The critical piece — container→host Supabase URL split

Inside the container, `localhost:54321` is the **container's** localhost, not the host's
Supabase. Puck's server-side Supabase client currently uses
`SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL` (`config.ts`), so `proxy.ts`'s
`supabase.auth.getUser()` (a network call to the Auth API, run on every protected route
inside the container) would fail. The `.env.ci` + `docker/compose.yml` plumbing already
anticipates this with `SUPABASE_URL_INTERNAL=http://host.docker.internal:54321`, but the
**app code does not consume it yet**.

Fix — split the two concerns currently conflated in `SUPABASE_URL`:

| Concern                                             | Source                                              | Why                                                                                                                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cookie key** (`SUPABASE_COOKIE_KEY`)              | `NEXT_PUBLIC_SUPABASE_URL` (public)                 | Must match the key the browser + E2E session-helper derive. Deriving from the internal host would produce `sb-host-auth-token` vs the browser's `sb-localhost-auth-token` → auth breaks. Stays public. |
| **Server API base URL** (new `SUPABASE_SERVER_URL`) | `SUPABASE_URL_INTERNAL ?? NEXT_PUBLIC_SUPABASE_URL` | Server-side `createServerClient` must reach the Auth API. Uses the internal host inside the container; falls back to the public URL everywhere else.                                                   |

`server-client.ts` and `proxy.ts` construct the server client with `SUPABASE_SERVER_URL`;
`SUPABASE_COOKIE_KEY` keeps deriving from the public URL. `env.ts` gains an **optional**
`SUPABASE_URL_INTERNAL`. This is the correct production pattern too — a real deploy has the
same container→backend split — so it is not CI-only scaffolding. Covered by a unit test
(TDD): given `SUPABASE_URL_INTERNAL` set, the server URL is the internal one and the cookie
key is still derived from the public URL; given it unset, both fall back to the public URL.

### Components

| #   | Component                                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                | Notes                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/web/next.config.ts`                                                               | Add `output: process.env.STANDALONE === "true" ? "standalone" : undefined`                                                                                                                                                                                                                                                                                                                                            | Standalone build for the image. Currently absent.                                                                                                                                                                 |
| 2   | `apps/web/src/shared/infrastructure/config/env.ts`                                      | Add optional `SUPABASE_URL_INTERNAL` to the zod schema                                                                                                                                                                                                                                                                                                                                                                | Optional string; absent outside the container.                                                                                                                                                                    |
| 3   | `apps/web/src/shared/infrastructure/supabase/config.ts`                                 | Add `SUPABASE_SERVER_URL = SUPABASE_URL_INTERNAL ?? NEXT_PUBLIC_SUPABASE_URL`; keep `SUPABASE_COOKIE_KEY` on the public URL                                                                                                                                                                                                                                                                                           | The URL split. Unit-tested.                                                                                                                                                                                       |
| 4   | `apps/web/src/shared/infrastructure/supabase/server-client.ts`, `apps/web/src/proxy.ts` | Construct server client with `SUPABASE_SERVER_URL`                                                                                                                                                                                                                                                                                                                                                                    | Reachability inside the container.                                                                                                                                                                                |
| 5   | `docker/ci/Dockerfile`                                                                  | Fill placeholders: deps (web + packages manifests) → builder (`pnpm --filter web build`, standalone) → runner (copy `/app/web` standalone + nginx/supervisord/watcher). Build-args bake `NEXT_PUBLIC_*` incl. `NEXT_PUBLIC_ENABLE_TEST_IDS=true`                                                                                                                                                                      | Single app rooted at `/`. `STANDALONE=true`.                                                                                                                                                                      |
| 6   | `docker/prod/nginx.conf`                                                                | Uncomment the web block: `upstream web_app 127.0.0.1:5000`, `location / → web_app`; keep `/health`                                                                                                                                                                                                                                                                                                                    | Shared prod+CI config; only the web block is scaffolded, ready to fill.                                                                                                                                           |
| 7   | `docker/prod/supervisord.conf`                                                          | Uncomment `[program:web]` (`node /app/web/apps/web/server.js`, PORT 5000); gate nginx on `nc -z 127.0.0.1 5000`                                                                                                                                                                                                                                                                                                       | The CI Dockerfile copies all three helper files the shared config references — `watcher.mjs`, `warmer.sh`, `boot-reporter.mjs` — so no supervisord program has a missing file. They no-op without Telegram creds. |
| 8   | `.env.ci`                                                                               | `APPS_MODE=docker`, `SUPABASE_MODE=docker`, `PUCK_PROD_IMAGE_NAME=puck-ci`, `PUCK_PROD_CONTAINER_NAME=puck-ci`, `HOST_PORT=5050`, `NEXT_PUBLIC_WEB_URL=http://localhost:5050`, `NEXT_PUBLIC_ENABLE_TEST_IDS=true`. Replace `$secret:CI_SUPABASE_ANON_KEY` / `_SERVICE_ROLE_KEY` with the **literal demo keys**. Keep `SUPABASE_URL=http://localhost:54321`, `SUPABASE_URL_INTERNAL=http://host.docker.internal:54321` | Demo keys are public constants.                                                                                                                                                                                   |
| 9   | `scripts/e2e.mjs` (new)                                                                 | Orchestrator adapted from CandyStore, simplified to one app: `loadEnv(ci)` → (docker) `supabase:docker start` → (docker) if image `puck-ci` exists `docker compose up` else `docker:build`, `waitForHttp(http://127.0.0.1:5050/, 120s)` → run `apps/web` Playwright with `TARGET_ENV`. Supports `APPS_MODE=local` (`pnpm dev`) for local runs.                                                                        | No `--app` fan-out (only web).                                                                                                                                                                                    |
| 10  | `apps/web/playwright.config.ts`                                                         | Drop `webServer: pnpm dev`; source `baseURL` from `NEXT_PUBLIC_WEB_URL ?? http://localhost:5000`. App lifecycle owned by `e2e.mjs`.                                                                                                                                                                                                                                                                                   | Matches CandyStore (no webServer).                                                                                                                                                                                |
| 11  | `apps/web/e2e/helpers/session.ts`                                                       | `E2E_BASE_URL` fallback → the `HOST_PORT` origin; keep admin API on the public Supabase URL (`localhost:54321`, reached from the host runner)                                                                                                                                                                                                                                                                         | Test runner is on the host, so `localhost:54321` is correct there.                                                                                                                                                |
| 12  | `.github/workflows/ci.yml`                                                              | Add `docker-build` job (build+push `ghcr.io/<repo>:<sha>`, `cache-from/to: type=gha,mode=max`, literal build-args) + `e2e-tests` job (pull+tag `puck-ci`, Supabase CLI, cached chromium, `node scripts/e2e.mjs --env ci --app web`, upload `playwright-report`). Add `e2e-tests` to `CI Gate` `needs` + `RESULTS`. Scope to `web`/`packages` changes; docs-only skips.                                                | See CI section.                                                                                                                                                                                                   |
| 13  | root `package.json`                                                                     | Add `e2e:ci` / `e2e:dev` scripts wrapping `scripts/e2e.mjs`                                                                                                                                                                                                                                                                                                                                                           | Convenience + parity with sisters.                                                                                                                                                                                |

### CI jobs

**`docker-build`** (needs `changes`, skip docs-only): checkout → login ghcr →
buildx → `docker/build-push-action` with `context: .`, `file: docker/ci/Dockerfile`,
`push: true`, `tags: ghcr.io/<owner>/<repo>:<sha>`, `cache-from/to: type=gha,mode=max`,
build-args (`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY=<demo>`, `NEXT_PUBLIC_WEB_URL=http://localhost:5050`,
`NEXT_PUBLIC_ENABLE_TEST_IDS=true`, `NEXT_PUBLIC_BUILD_HASH=ci`). Outputs the image ref.

**`e2e-tests`** (needs `changes`, `docker-build`; skip docs-only): checkout → pnpm/node →
install deps → login ghcr → `docker pull <image>` + `docker tag <image> puck-ci` →
version-pinned cached chromium (`playwright install --with-deps chromium`) →
`node scripts/e2e.mjs --env ci --app web` → upload `apps/web/playwright-report/`
(`if: always()`, retention 7d). `CI=true` is set by Actions, so `.env.ci` `$secret:` refs
(the few that remain — Telegram/email/OAuth, all optional for these specs) resolve to `""`.
Supabase is started **inside** `e2e.mjs` (because `.env.ci` says `SUPABASE_MODE=docker`),
not by a workflow step.

**`CI Gate`**: add `e2e-tests` to `needs` and to the `RESULTS` env so a failure blocks
merge; a skip (docs-only) does not.

## Data flow (account E2E, in CI)

1. `e2e.mjs` runs `supabase start` → Postgres+Auth on host `:54321`, migrations applied
   (foundation triggers auto-create `user_profiles` on user creation).
2. `e2e.mjs` `docker compose up` → container serves web at host `:5050`;
   compose injects `SUPABASE_URL_INTERNAL=http://host.docker.internal:54321` +
   `SUPABASE_SERVICE_ROLE_KEY=<demo>` at container runtime.
3. Playwright (host) fixture: admin API on `localhost:54321` creates a confirmed user,
   injects the `sb-localhost-auth-token` cookie (key derived from the **public** URL).
4. Browser → `localhost:5050/en/account`. Container SSR (`proxy.ts`) validates the session
   via `getUser()` → `host.docker.internal:54321` (the **internal** URL). Demo keys verify
   against the demo JWT secret the CLI booted with.
5. Test edits the display name, saves, reloads → asserts DB persistence. Teardown deletes
   the user (now unconditional after the earlier review fix).

## Testing

- **Unit (TDD)**: the `SUPABASE_SERVER_URL` / cookie-key split in `config.ts` — internal
  set vs unset, cookie key always from the public URL. RED before implementation.
- **E2E**: the existing 4 specs run unchanged against the container (the point of the work).
  No new specs required; the value is that they now run in CI.
- **Local verification** before pushing: build the image locally, `supabase start`,
  `node scripts/e2e.mjs --env ci --app web`, confirm all 4 specs pass against the container.

## Risks & mitigations

| Risk                                                                                        | Mitigation                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase CLI image pulls are slow (~2–3 min)                                                | Within the 60-min E2E job timeout; acceptable.                                                                                                                                          |
| Flaky E2E blocks unrelated PRs                                                              | `retries: 2` (CI) already configured; `--max-failures=1`; suite is small, deterministic, no external network. Demote from `CI Gate` if flakiness proves real (trivial one-line change). |
| `host.docker.internal` only maps on Linux with `host-gateway`                               | Compose already sets `extra_hosts: host.docker.internal:host-gateway`; GHA runners are Linux. Local docker E2E on Mac/Windows works natively.                                           |
| Cookie-key mismatch container vs browser                                                    | Explicitly designed against: cookie key always derives from the public URL. Unit-tested.                                                                                                |
| Shared `supervisord.conf` references `warmer.sh`/`boot-reporter.mjs` not copied in CI image | CI Dockerfile copies `watcher.mjs`, `warmer.sh`, `boot-reporter.mjs` (they no-op without Telegram creds).                                                                               |

## Dependencies & interactions

- **PR #9 (`chore/GH-4_CI-Build-Job`)** adds a `build` job and edits `CI Gate`'s `needs`.
  This branch also edits `CI Gate`'s `needs` (adds `e2e-tests`). Whichever merges second
  reconciles the `needs`/`RESULTS` lines. If #9 merges first, rebase this branch on it; the
  final `CI Gate` `needs` is `[changes, quality, unit-tests, build, e2e-tests]`.
- No GitHub secrets required (decision 2).

## Out of scope

- Multi-app image (api/worker/bot) — Dockerfile/nginx/supervisord keep their scaffolded
  placeholders for those; only the web blocks are filled now.
- Coverage-threshold gating, real a11y/visual-regression jobs, browser/node matrix,
  sharding — separate follow-ups.
- Wiring `test:db` integration tests into CI.
