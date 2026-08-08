# Puck Repo Boilerplate — design spec

_Date: 2026-06-21. Outcome of a brainstorming session. Goal: turn Puck's repo into
a genericized boilerplate clone of Libra's dev-platform backbone, so that the
day we start coding any sub-project, every rail is already in place._

## 1. Purpose

Puck and Libra are sister projects that deliberately share a toolchain. This
spec captures **porting Libra's entire developer platform into Puck**, made
generic, with no business/domain code. **Libra (`Z:\Github\libra`) is
the source of truth** for AI tooling, performance tooling, general tooling,
technology choices, and rules.

The result is "almost a boilerplate ready to get the code into it": a contributor
(human or agent) can start sub-project #1 and find linting, formatting, CI, git
hooks, the AI-assistant layer, secrets discipline, the env resolver, Docker
templates, and architecture docs already working.

## 2. Goals & non-goals

**Goals**

- Reproduce Libra's root-level rails in Puck, genericized (`libra`/
  `libra` → `puck`, `@monorepo` → `@puck`, business specifics removed).
- Port _everything_ reusable — including frontend rails (tailwind, shadcn,
  component patterns, url-state, e2e selectors) — because sub-project #2 is a
  Next.js app and we want it ready.
- Carry the _shape_ of every secret (names + example placeholders), so Puck can
  provision its own credentials with the same tools Libra uses.
- Keep the repo installable and all quality gates green against an **empty
  workspace** (no `apps/*`/`packages/*` yet).

**Non-goals**

- No business/domain source code; no `apps/*` or `packages/*` directories yet
  (each workspace is created when its sub-project starts — "root rails only").
- No real secret values are copied from Libra — ever.
- No live deploy. Docker, deploy, and codegen are ported as **templates**, not
  active pipelines.
- This spec does not implement sub-project #1; it prepares the ground for it.

## 3. Guiding principles

1. **Root rails only.** Everything lives at the repo root (or `.claude/`,
   `docs/`, `docker/`, `scripts/`, `supabase/`, `config/`). No app/package dirs.
   Quality configs run against empty `apps/*`/`packages/*` globs today and
   self-apply when a workspace appears.
2. **Genericize, don't prune.** Nothing Libra has is dropped for being
   "frontend"; it is made generic and kept ready.
3. **Same tools, Puck's own keys.** `.secrets.example` lists every credential as
   an empty placeholder, including Cloudflare tunnel keys. Real values are Puck's,
   provisioned later, never Libra's.
4. **Templates over dead wiring.** Anything that needs app code to function
   (Docker app stages, deploy targets, scoped CI matrices, codegen inputs) is
   ported as a parameterized template with a `# wire when first app lands`
   marker, so it is obvious and harmless.
5. **Libra is source of truth.** When in doubt about a tool, version, rule,
   or config, mirror Libra.

## 4. The genericization transform

Apply to every ported file:

| Transform                | From → To                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Project/package naming   | `libra` / `libra` → `puck`; `@monorepo/*` → `@puck/*`                                                                                  |
| Business app lists       | hardcoded `store/admin/payments/landing/...` → generic patterns / parameterized lookups                                                |
| URLs / domains / IDs     | real Supabase project-ids, domains, ports → placeholders or Puck's own                                                                 |
| Secrets                  | real values → `KEY=` placeholders in `.secrets.example`; gitignored `.secrets` for reals                                               |
| Workspace-coupled config | knip workspace list, eslint generated-path ignores, turbo `globalEnv`, ls-lint app rules → generic patterns valid with zero workspaces |
| User-specific values     | Libra admin emails / accounts → Puck's own or placeholders                                                                             |

## 5. Scope by layer

Nothing pruned. Each item is ported and genericized.

### A. AI-assistant layer (`.claude/`)

- **Rules** — all of `.claude/rules/*`, including frontend rules: `tailwind`,
  `css-consistency`, `component-patterns`, `one-component-per-file`, `url-state`,
  `e2e-selectors`, plus backend/general rules (`architecture`, `solid-principles`,
  `dry-principle`, `kiss-principle`, `git-safety`, `git-workflow`,
  `commit-policy`, `naming-conventions`, `no-hardcoding`, `testing`, `mcp-first`,
  `mcp-standards`, `monorepo-architecture`, `portability`,
  `single-source-of-truth`, `multi-agent-persistence`, `libraries-over-manual-code`,
  `generated-code-policy`, `build-checks`, `code-review-standards`,
  `telegram-notifications`, `supabase-wipe`, etc.). Puck-specific facts updated
  (e.g. `telegram-notifications` framed for Puck's own bot; `supabase-wipe`
  pointed at Puck's project).
- **Skills** — all of `.claude/skills/*` (create-feature, create-component,
  create-hook, create-api-integration, code-review, ai-documents-audit,
  start-task, submit-pr, merge-pr, review-pr-comments, sync-with-develop,
  create-release, security-audit, investigate-error, checkpoint/resume-checkpoint,
  capture-evidences, e2e-eval, analyze-bundle, storybook, run-tests, verify-code,
  full-review, and the rest), genericized.
- **Agents** — `.claude/agents/*` (code-reviewer, frontend-developer,
  fullstack-developer, graphql-architect, nextjs-architecture-expert,
  ui-ux-designer, mcp-first), genericized.
- **Commands** — `.claude/commands/*` (capture-evidences, create-release,
  e2e-eval, investigate-error, merge-pr, post-merge, review-pr-comments,
  security-audit, sync-with-develop).
- **Docs** — `.claude/docs/architecture/{overview,layers}.md` and
  `.claude/docs/README.md`, re-grounded on Puck's architecture (event-scheduler
  platform; hexagonal backend + Next web app + worker + bot).
- **Settings** — `.claude/settings.json` with the same plugins (context7,
  superpowers). `settings.local.json` is gitignored and not committed.
- **MCP** — port all server wrappers under `.claude/tools/*.mjs` (github-unified,
  git, linear, vercel, vercel-lite, logrocket, slack, github-setup) plus the
  `.claude/tools/README.md`. `.mcp.json` enables servers that need no external
  account to be useful now (shadcn, next-devtools, playwright, github, git) and
  leaves account-bound servers (linear, slack, vercel, logrocket) configured with
  documented env keys, enabled when Puck has those accounts. Tokens load from a
  gitignored `.claude/tools/.env.local` (with an `.env.local.example`).
- **`skills-lock.json`** ported/regenerated for Puck.

### B. Code-quality tooling

- **Git hooks** — `.husky/pre-commit` (lint-staged + workspace manifest checks via
  sherif/syncpack when manifests change) and `.husky/pre-push` (changes-vs-develop
  detection, skip docs-only, scoped `turbo test`, Docker health check when deploy
  files change). Genericized so they no-op cleanly with no workspaces.
- **lint-staged** — `*.{ts,tsx,js,jsx}` → prettier --check, eslint
  `--no-warn-ignored --max-warnings=0`, secretlint; `*.{json,md,css}` → prettier.
- **ESLint** — full flat `eslint.config.mjs` with every plugin Libra uses
  (typescript-eslint, react-hooks, unused-imports, security, boundaries, sonarjs,
  testing-library, vitest, @tanstack/query, unicorn, better-tailwindcss, jsx-a11y,
  i18next). Includes enforcement that **e2e/test selectors use `data-testid`
  only** (the `e2e-selectors` rule reinforced by lint). Ignores expressed as
  generic generated-path patterns.
- **Other quality tools** — `secretlint`(+`.secretlintignore`), **Semgrep**
  (security-audit + owasp-top-ten, as used in `pr-checks`), `cspell` (Puck word
  list), `.ls-lint.yml` (kebab/camel/Pascal rules, generic), `knip` (generic
  workspaces), `.jscpd.json`, `madge` (circular deps), `sherif`, `.syncpackrc.json`
  (internal deps use `workspace:*`), `stylelint` (+ tailwind config), prettier
  (`.prettierrc` + `.prettierignore`).

### C. Secrets & environment

- **Env resolver** — `scripts/load-env.mjs`: resolves `$secret:KEY` references in
  `.env.*` files against `.secrets` at runtime. Ported and unit-tested.
- **Env files** — `.env.dev`, `.env.ci`, `.env.prod` (genericized; `.env.staging`
  optional). Use `$secret:KEY` for sensitive values.
- **Secrets** — `.secrets` (gitignored) + `.secrets.example` documenting every
  key name Puck needs, including Cloudflare tunnel keys, Supabase per-env keys,
  OAuth provider keys, Sentry, and test creds — all as empty placeholders.
- **Sync** — `scripts/sync-secrets.mjs` (+ `pnpm sync-secrets`) to pull repo
  secrets into `.secrets`.
- **Gitignore** — secret-file entries (`.env`, `.secrets`, `*.local`,
  `.claude/tools/.env.local`, server env files).

### D. CI/CD (`.github/`)

- **Active now** — `ci.yml` (format, lint, typecheck, test, monorepo checks via
  sherif/syncpack), `pr-checks.yml` (conventional PR title, branch-target rules,
  security audit: pnpm audit + Semgrep + secretlint), `pr-freshness.yml`,
  `release.yml` (GitHub Release from `release/*` PRs, `vYYYY.MM.DD.N`),
  `notify-bug-issue.yml`. Shared scripts `detect-changes.sh` /
  `select-workspaces.sh` genericized.
- **Templates** — `deploy-gcp.yml`, `deploy-local.yml`, `sandbox-release.yml`,
  `backup-scheduled.yml`, `sync-secrets.yml` ported with parameters and the
  `# wire when first app/deploy lands` marker.
- **Meta** — CODEOWNERS, issue/PR templates, dependabot if present.

### E. Docker & infra

- `.dockerignore`, `docker/` structure (`ci/`, `prod/`, `infra/`) ported as
  templates adapted for **Node services (Fastify API + worker, the Telegram bot)
  plus the Next.js web app** — multi-stage builds, supervisord/compose, the
  Supabase infra volumes/init pattern. `supabase/config.toml.template` +
  `supabase/{migrations,seed.sql,snippets,tests}` skeleton.
- Helper scripts: `docker-build.mjs`, `docker-teardown.mjs`,
  `docker-health-check.sh`, `supabase-cmd.mjs`, `supabase-docker.mjs`,
  `cloudflared*.mjs`, `backup-prod.mjs` — genericized.

### F. Repo meta

- `tsconfig.base.json` (shared strict flags; see §6 divergence), root
  `package.json` (full script set + devDependencies + `packageManager` + engines,
  genericized), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.npmrc`
  (`node-linker=hoisted`), `.nvmrc` (Node 24), `.editorconfig`, `.gitattributes`,
  `orval.config.ts` (template), vitest base config/aliases, optional
  `walkthrough.md` / `PR_DESC.md` templates, `LICENSE` (already MIT).

## 6. Known divergences from Libra

1. **TypeScript module resolution.** Libra is all-Next and uses `bundler`
   resolution. Puck has both Node services (NodeNext, ESM, `.js` import
   specifiers) and a Next app. `tsconfig.base.json` carries the shared strict
   flags only; **module/moduleResolution is set per-workspace** when each
   workspace is created. Not blocking at the boilerplate stage.
2. **Runtime shape.** Libra's Docker serves Next apps via nginx. Puck adds
   long-running Node services, so Docker templates account for service processes,
   not only static/Next serving.

## 7. Deferred decisions (do not block the boilerplate)

- **Deploy target** — likely self-host alongside the existing Libra box;
  could be GCP like Libra. Confirm before wiring `deploy-*.yml`.
- **Environment count** — default `dev / ci / prod`; `staging` (with Cloudflare
  tunnel) is an easy add.
- **Optional MCP accounts** — Linear, Slack, Vercel, LogRocket wrappers are
  present; enable when Puck has the accounts/keys.

## 8. Definition of done

1. `pnpm install` clean (lockfile committed).
2. `pnpm format:check`, `pnpm lint`, and `pnpm check:tools`
   (cspell/knip/jscpd/ls-lint/madge/sherif/syncpack) all green against the
   empty-workspace repo.
3. Husky `pre-commit` and `pre-push` fire and pass.
4. `secretlint` and Semgrep run clean; `.secrets.example` complete; no real
   secret values committed.
5. GitHub workflow files parse as valid (e.g. via `actionlint`).
6. `pnpm typecheck` and `pnpm test` no-op cleanly (no workspaces yet).
7. `scripts/load-env.mjs` has unit tests covering `$secret:KEY` resolution.
8. `README.md` / `CLAUDE.md` updated to mention the boilerplate is in place and
   how the rails work.

## 9. Out of scope / future work

- Implementing sub-project #1 (foundation) — separate spec/plan already exists.
- Populating real workspaces (`apps/web`, `apps/api`, `apps/worker`, the bot,
  `packages/*`) — happens per sub-project.
- Choosing and wiring the live deploy pipeline.
