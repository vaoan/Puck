# Puck Repo Boilerplate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port CandyStore's developer-platform backbone into Puck as a genericized, root-only boilerplate so any sub-project can start with every rail (lint, format, CI, hooks, AI-assistant layer, secrets, env resolver, Docker templates) already working.

**Architecture:** This is a **port**, not a greenfield build. For each artifact, the source of truth is the corresponding file in `Z:\Github\candystore`. The work per file is: copy it into Puck, apply the genericization transform (§ Global Constraints), then verify. Full original content is authored in this plan only where Puck deliberately diverges from CandyStore. Everything lands at the repo root — **no `apps/*` or `packages/*` directories are created**; quality configs run against empty workspace globs and self-apply when a workspace later appears.

**Tech Stack:** pnpm 10 + Turbo monorepo, TypeScript (strict), ESLint flat config, Prettier, Vitest, Husky + lint-staged, secretlint + Semgrep, cspell/knip/jscpd/madge/sherif/syncpack, Supabase CLI, Docker, GitHub Actions, Node `.mjs` scripts.

## Global Constraints

Every task implicitly includes these. Copy values verbatim.

- **Package manager:** `pnpm@10.32.1`; `engines.node` `>=24`; `.nvmrc` = `24`.
- **Source of truth:** `Z:\Github\candystore`. When unsure about a tool, version, rule, or config value, mirror CandyStore.
- **Genericization transform (apply to every ported file):**
  - `candyshop` → `puck`; `candystore` → `puck`; `Candystore`/`CandyStore` → `Puck` (except the one intentional reference: "CandyStore-style permission system").
  - `@monorepo/*` → `@puck/*`; package scope is `@puck/<name>`.
  - Hardcoded business app names (`store`, `admin`, `payments`, `landing`, `playground`, `studio`, `auth-app`) → generic patterns or parameterized lookups.
  - Real Supabase project-ids, domains, ports, admin emails, account ids → placeholders or Puck's own.
  - Secret **values** → never copied. Only key **names** survive, as empty `KEY=` placeholders in `.secrets.example`.
- **Filenames:** kebab-case (enforced by `unicorn/filename-case` + `.ls-lint.yml`).
- **Root rails only:** never create `apps/*` or `packages/*` directories or source in this plan.
- **No secrets in git:** `.secrets`, `.env`, `*.local`, `.claude/tools/.env.local` are gitignored.
- **Commits:** never use `--no-verify`; let hooks run. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Branch:** work on `docs/repo-boilerplate-spec` (already checked out) or a child branch; `develop`/`main` are protected (PR required).
- **Verification of "green on empty workspace":** each quality tool must exit 0 with zero `apps/*`/`packages/*` present.

---

## File Structure

Created/modified at the repo root (no app/package dirs):

```
package.json                 modify  — full script set + devDependencies (genericized)
pnpm-workspace.yaml          keep    — apps/*, packages/*
.npmrc                       modify  — node-linker=hoisted
.nvmrc / .editorconfig       keep/add
.gitattributes               keep
.gitignore                   modify  — secret-file + tooling entries
tsconfig.base.json           modify  — shared strict flags (per-workspace resolution later)
eslint.config.mjs            modify  — full flat config, all plugins, generic ignores
.prettierrc/.prettierignore  keep/modify
cspell.json                  modify  — Puck word list
.ls-lint.yml                 modify  — generic name rules
knip.json                    create  — tolerant of empty workspaces
.jscpd.json                  create
.syncpackrc.json             modify  — workspace:* rule
.secretlintrc.json           keep
.secretlintignore            create
stylelint.config.mjs         create
.semgrep.yml or CI-inline    create  — security-audit + owasp rulesets
.husky/pre-commit            modify
.husky/pre-push              modify
scripts/load-env.mjs         create  — $secret:KEY resolver
scripts/load-env.test.mjs    create  — resolver unit test
scripts/sync-secrets.mjs     create
scripts/detect-changes.sh    create  — generic
scripts/select-workspaces.sh create  — generic
.env.dev/.env.ci/.env.prod   create  — genericized
.secrets.example             modify  — every key name, placeholders only
.claude/{rules,skills,agents,commands,docs,tools}/  create — ported + genericized
.claude/settings.json        create
.mcp.json                    create
.github/workflows/*.yml      create/modify — active + template workflows
.github/CODEOWNERS + templates create
docker/{ci,prod,infra}/      create  — templates
.dockerignore                create
supabase/config.toml.template + skeleton  create
orval.config.ts              create  — template
vitest base config + aliases create
README.md / CLAUDE.md        modify  — note the boilerplate
```

---

## Phase 0 — Install foundation

### Task 1: Root manifest, workspace, and base configs

**Files:**

- Modify: `package.json`
- Modify: `.npmrc`
- Create/verify: `.nvmrc`, `.editorconfig`, `.gitattributes`
- Keep: `pnpm-workspace.yaml`
- Modify: `tsconfig.base.json`
- Modify: `.gitignore`

**Interfaces:**

- Produces: a `package.json` whose `scripts` and `devDependencies` are the genericized superset of CandyStore's, and an installable workspace. Later tasks rely on these dev tools being present.

- [ ] **Step 1: Read the CandyStore sources**

Read these and use them as the authoritative content (apply the transform):
`Z:\Github\candystore\package.json`, `\.npmrc`, `\.nvmrc`, `\.editorconfig`, `\.gitattributes`, `\tsconfig.base.json`, `\.gitignore`.

- [ ] **Step 2: Merge CandyStore's `devDependencies` into Puck's `package.json`**

Take the union of Puck's current devDeps and CandyStore's. Keep CandyStore's versions where they differ (source of truth). Ensure at minimum these are present (versions from CandyStore): `turbo@2.9.6`, `typescript@6.0.3`, `vitest@4.1.5`, `@vitest/coverage-v8`, `@vitest/eslint-plugin`, `eslint@9.39.4`, `@eslint/js`, `typescript-eslint@8.59.0`, `eslint-config-prettier`, `eslint-config-next`, `eslint-plugin-{import,security,sonarjs,unicorn,unused-imports,boundaries,i18next,react-hooks,jsx-a11y,better-tailwindcss}`, `@tanstack/eslint-plugin-query`, `eslint-plugin-testing-library`, `prettier@3.8.3`, `stylelint@17.9.1` + `stylelint-config-standard` + `stylelint-config-tailwindcss`, `cspell@10`, `knip@6.7.0`, `jscpd@4.0.9`, `madge@8`, `sherif@1.11.1`, `syncpack@14.3.1`, `husky@9.1.7`, `lint-staged@16.4.0`, `secretlint@12.3.1` + `@secretlint/secretlint-rule-preset-recommend`, `orval@8.9.0`, `supabase@2`, `tsx`, `@types/node@24`.

- [ ] **Step 3: Merge CandyStore's `scripts` (genericized)**

Bring over the script set, dropping any that reference business-only apps. Required scripts: `dev`, `build`, `typecheck`, `test`, `test:watch`, `test:coverage`, `lint`, `lint:fix`, `format`, `format:check`, `check:tools`, `check:style`, `codegen`, `codegen:supabase`, `codegen:all`, `db:start`, `db:reset`, `db:diff`, `db:types`, `sync-secrets`, `prepare` (`husky`). Set `check:tools` to a command that is green on an empty workspace, e.g.:

```json
"check:tools": "cspell \"**/*.{ts,tsx,md,json}\" --no-progress && ls-lint && syncpack lint && sherif"
```

(knip/jscpd/madge are added in Task 3 only after they're configured to tolerate empty workspaces.)

- [ ] **Step 4: Set `.npmrc`, `tsconfig.base.json`, `.gitignore`**

`.npmrc` contains `node-linker=hoisted`. For `tsconfig.base.json`, copy CandyStore's shared strict compiler flags but **omit** module/moduleResolution (those are set per-workspace later) — keep `strict: true`, `lib` including `dom`/`esnext`, `skipLibCheck`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `incremental`. Append to `.gitignore` (dedupe): `.env`, `.secrets`, `*.local`, `.claude/tools/.env.local`, `.logs/`, `.turbo/`, `coverage/`, `playwright-report/`.

- [ ] **Step 5: Install and verify**

Run: `pnpm install`
Expected: completes; lockfile updates; `node_modules/.bin/eslint`, `prettier`, `cspell`, `syncpack`, `sherif`, `ls-lint` exist.

- [ ] **Step 6: Verify base tooling is green on empty workspace**

Run: `pnpm check:tools`
Expected: PASS (no workspaces → nothing to flag).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml .npmrc .nvmrc .editorconfig .gitattributes tsconfig.base.json .gitignore
git commit -m "chore: port CandyStore root manifest and base configs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 1 — Code-quality configs

### Task 2: ESLint, Prettier, Stylelint, cspell, ls-lint, syncpack, secretlint

**Files:**

- Modify: `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `cspell.json`, `.ls-lint.yml`, `.syncpackrc.json`, `.secretlintrc.json`
- Create: `stylelint.config.mjs`, `.secretlintignore`

**Interfaces:**

- Produces: a full lint stack that runs clean on the empty repo and is ready for both backend and frontend code.

- [ ] **Step 1: Read CandyStore sources**

`Z:\Github\candystore\eslint.config.mjs`, `\.prettierrc`, `\.prettierignore`, `\cspell.json`, `\.ls-lint.yml`, `\.syncpackrc.json`, `\.secretlintrc.json`, `\.secretlintignore`, `\stylelint.config.mjs`.

- [ ] **Step 2: Port `eslint.config.mjs` with all plugins + generic ignores**

Copy CandyStore's flat config (all plugins listed in Task 1 Step 2). Replace workspace-specific `ignores` with generic patterns so it is valid with zero workspaces:

```js
ignores: [
  "**/dist/**", "**/.next/**", "**/out/**", "**/build/**", "**/coverage/**",
  "**/node_modules/**", "**/*.config.{js,mjs,ts,cjs}", "**/next-env.d.ts",
  "**/generated/**", "**/*.generated.ts", "**/database.types.ts",
  ".claude/**", "**/public/mockServiceWorker.js",
],
```

Keep the `data-testid`-only enforcement for test files (the rule that bans selecting by text/role-string/class in `*.spec.ts`/`e2e`); if CandyStore expresses it via a custom rule or `no-restricted-syntax`, copy that block verbatim.

- [ ] **Step 3: Port the remaining configs**

`.prettierrc` (`{ "endOfLine": "auto" }`), `.prettierignore` (add `assets/`, generated, lockfiles), `cspell.json` (replace the candy word list with Puck terms: `puck`, `pgmq`, `supabase`, `grammy`, `fastify`, `pnpm`, `orval`, `shadcn`, `tanstack`, plus keep generic technical terms), `.ls-lint.yml` (generic kebab/camel/Pascal rules, ignore `.claude .github .husky docs assets generated`), `.syncpackrc.json` (internal `@puck/*` deps use `workspace:*`), `.secretlintrc.json` (preset-recommend), `.secretlintignore`, `stylelint.config.mjs` (standard + tailwindcss).

- [ ] **Step 4: Verify each tool is green**

Run: `pnpm lint`
Expected: PASS (no source files; config loads without error).
Run: `pnpm exec cspell "**/*.{ts,tsx,md,json}" --no-progress`
Expected: PASS.
Run: `pnpm exec ls-lint`
Expected: PASS.
Run: `pnpm exec secretlint "**/*"`
Expected: PASS (no findings).

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs .prettierrc .prettierignore cspell.json .ls-lint.yml .syncpackrc.json .secretlintrc.json .secretlintignore stylelint.config.mjs
git commit -m "chore: port full lint/format/quality config stack

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: knip, jscpd, madge wired into `check:tools` (empty-workspace safe)

**Files:**

- Create: `knip.json`, `.jscpd.json`
- Modify: `package.json` (`check:tools`)

**Interfaces:**

- Consumes: the installed dev tools from Task 1.
- Produces: a `check:tools` that includes dead-code, duplication, and circular-dep checks and still exits 0 with no workspaces.

- [ ] **Step 1: Read CandyStore `knip.json` and `.jscpd.json`**

`Z:\Github\candystore\knip.json`, `\.jscpd.json`.

- [ ] **Step 2: Author empty-workspace-safe `knip.json`**

Use a workspaces map keyed by the globs (not concrete app names):

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "workspaces": {
    ".": { "entry": ["scripts/*.mjs"], "project": ["scripts/**/*.mjs"] }
  },
  "ignore": ["**/generated/**", "**/*.config.*"],
  "ignoreDependencies": []
}
```

- [ ] **Step 3: Author `.jscpd.json`**

Copy CandyStore's, set `"threshold"`, formats `typescript,tsx,javascript,jsx`, and `"ignore"` globs including `node_modules`, `.next`, `coverage`, `generated`, `.claude`, `docs`, `**/*.test.*`.

- [ ] **Step 4: Extend `check:tools` to include the three tools, guarded for empty dirs**

```json
"check:tools": "cspell \"**/*.{ts,tsx,md,json}\" --no-progress && ls-lint && syncpack lint && sherif && knip --no-exit-code && jscpd . && (madge --circular scripts || true)"
```

(`knip --no-exit-code` and the `madge … || true` keep the empty repo green; once workspaces exist, tighten in their sub-project.)

- [ ] **Step 5: Verify**

Run: `pnpm check:tools`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add knip.json .jscpd.json package.json
git commit -m "chore: add knip/jscpd/madge to check:tools (empty-workspace safe)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Git hooks

### Task 4: Husky pre-commit and pre-push

**Files:**

- Modify: `.husky/pre-commit`, `.husky/pre-push`
- Modify: `package.json` (`lint-staged` block, if not already present)

**Interfaces:**

- Consumes: lint stack (Task 2), `check:tools` (Task 3).
- Produces: hooks that run lint-staged + manifest checks on commit and scoped tests on push, no-op-safe with no workspaces.

- [ ] **Step 1: Read CandyStore hooks**

`Z:\Github\candystore\.husky\pre-commit`, `\.husky\pre-push`.

- [ ] **Step 2: Port `pre-commit`**

Run lint-staged; when `package.json`/`pnpm-workspace.yaml` are among staged files, also run `pnpm exec sherif` and `pnpm exec syncpack lint`. Keep CandyStore's sequential execution to avoid SIGKILL. Ensure `lint-staged` block in `package.json` matches:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx,mjs}": ["prettier --check", "eslint --max-warnings=0 --no-warn-ignored", "secretlint"],
  "*.{json,md,css}": ["prettier --check"]
}
```

- [ ] **Step 3: Port `pre-push` (genericized, no-op safe)**

Detect changes vs `develop`; if docs-only, skip. Otherwise run `pnpm turbo test` (no-op with no workspaces → passes). Guard the Docker health check behind "deploy files changed" so it doesn't run now.

- [ ] **Step 4: Verify hooks fire**

Run: `git add .husky/pre-commit .husky/pre-push package.json && git commit -m "chore: port husky hooks"` (let it run; do NOT use `--no-verify`).
Expected: lint-staged runs and passes; commit succeeds.
Run: `git push --dry-run origin HEAD` is not valid for hooks; instead simulate: `bash .husky/pre-push origin <url>` or push to the feature branch later.
Expected: pre-push exits 0 (docs/config-only or no workspaces).

- [ ] **Step 5: Amend commit trailer if needed / Commit**

If the commit in Step 4 lacks the trailer, amend:

```bash
git commit --amend -m "chore: port husky pre-commit and pre-push hooks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Secrets & environment

### Task 5: `$secret:KEY` env resolver with unit tests

**Files:**

- Create: `scripts/load-env.mjs`
- Create: `scripts/load-env.test.mjs`
- Modify: `package.json` (vitest must pick up `scripts/**/*.test.mjs`) or add a dedicated vitest project config

**Interfaces:**

- Produces: `resolveEnv(envFileContents: string, secrets: Record<string,string>): Record<string,string>` and a CLI entry that loads an `.env.<mode>` file resolving `$secret:KEY` against `.secrets`.

- [ ] **Step 1: Read CandyStore resolver**

`Z:\Github\candystore\scripts\load-env.mjs` (and any `scripts/load-env*.mjs`). Mirror its public behavior.

- [ ] **Step 2: Write the failing test**

`scripts/load-env.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { resolveEnv } from "./load-env.mjs";

describe("resolveEnv", () => {
  it("substitutes $secret:KEY with the secret value", () => {
    const env =
      "SUPABASE_URL=https://x\nSERVICE_KEY=$secret:PROD_SERVICE_KEY\n";
    const secrets = { PROD_SERVICE_KEY: "abc123" };
    expect(resolveEnv(env, secrets)).toMatchObject({
      SUPABASE_URL: "https://x",
      SERVICE_KEY: "abc123",
    });
  });

  it("throws when a referenced secret is missing", () => {
    expect(() => resolveEnv("K=$secret:MISSING\n", {})).toThrow(/MISSING/);
  });

  it("leaves plain values untouched and ignores blank/comment lines", () => {
    const env = "# comment\n\nFOO=bar\n";
    expect(resolveEnv(env, {})).toEqual({ FOO: "bar" });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run scripts/load-env.test.mjs`
Expected: FAIL (`resolveEnv` not found / module missing).

- [ ] **Step 4: Implement `scripts/load-env.mjs`**

Export a pure `resolveEnv(envText, secrets)` that parses `KEY=VALUE` lines (skipping blanks/`#`), replaces a whole-value `$secret:NAME` with `secrets[NAME]` (throwing `Error("Missing secret: NAME")` if absent), and returns the map. Add a CLI wrapper (reads `.env.<mode>` + `.secrets`, applies `resolveEnv`, writes resolved vars to `process.env` / prints export lines) mirroring CandyStore's interface. Keep it dependency-free.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run scripts/load-env.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/load-env.mjs scripts/load-env.test.mjs package.json
git commit -m "feat: add \$secret:KEY env resolver with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: `.secrets.example`, `.env.*`, and `sync-secrets`

**Files:**

- Modify: `.secrets.example`
- Create: `.env.dev`, `.env.ci`, `.env.prod`
- Create: `scripts/sync-secrets.mjs`

**Interfaces:**

- Consumes: `load-env.mjs`.
- Produces: a documented secret surface (names only) and per-env files using `$secret:KEY`.

- [ ] **Step 1: Read CandyStore sources**

`Z:\Github\candystore\.secrets.example`, `\.env.dev`, `\.env.ci`, `\.env.prod`, `\scripts\sync-secrets.mjs`.

- [ ] **Step 2: Author `.secrets.example` (placeholders only)**

List every key name Puck needs, each as `KEY=`. Include per-env Supabase keys (`DEV_/CI_/PROD_SUPABASE_{URL,ANON_KEY,SERVICE_ROLE_KEY}`, `CI_SUPABASE_{JWT_SECRET,DB_PASSWORD}`), OAuth (`SUPABASE_AUTH_EXTERNAL_GOOGLE_{CLIENT_ID,SECRET}`), Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`), email (`RESEND_API_KEY`), Cloudflare tunnel (`PUCK_CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARED_TUNNEL_CREDENTIALS`, `CLOUDFLARED_CONFIG`), Sentry (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`), and MCP tokens (`GITHUB_PERSONAL_ACCESS_TOKEN`, `LINEAR_API_KEY`, `VERCEL_TOKEN`, `LOGROCKET_API_KEY`, `SLACK_*`). **No values.**

- [ ] **Step 3: Author `.env.dev/.env.ci/.env.prod`**

Genericize CandyStore's: non-secret config inline; secrets as `$secret:KEY`. Default to `dev/ci/prod`; do not create `.env.staging` (deferred). Point all Supabase references at placeholders, never CandyStore URLs.

- [ ] **Step 4: Port `sync-secrets.mjs`**

Mirror CandyStore's GitHub-secrets→`.secrets` puller, genericized.

- [ ] **Step 5: Verify secretlint finds nothing and example has no values**

Run: `pnpm exec secretlint ".secrets.example" ".env.dev" ".env.ci" ".env.prod"`
Expected: PASS.
Run: `grep -nE "=.+" .secrets.example | grep -vE "=$"`
Expected: no output (every line is `KEY=` with empty value).

- [ ] **Step 6: Commit**

```bash
git add .secrets.example .env.dev .env.ci .env.prod scripts/sync-secrets.mjs
git commit -m "chore: add secret surface, per-env files, and sync-secrets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 — AI-assistant layer

### Task 7: `.claude/` rules, agents, commands, skills, docs, settings

**Files:**

- Create: `.claude/rules/*`, `.claude/agents/*`, `.claude/commands/*`, `.claude/skills/*`, `.claude/docs/*`, `.claude/settings.json`
- Create: `skills-lock.json`

**Interfaces:**

- Produces: the full assistant rule/skill/agent set, genericized; consumed by humans+agents, not by code.

- [ ] **Step 1: Copy the trees**

Copy `Z:\Github\candystore\.claude\{rules,agents,commands,skills,docs}` and `settings.json` and `skills-lock.json` into Puck. (Do **not** copy `settings.local.json`.)

- [ ] **Step 2: Apply the genericization transform across the trees**

Replace `candyshop`/`candystore`/`@monorepo` per Global Constraints. Re-ground Puck-specific docs: `.claude/docs/architecture/{overview,layers}.md` describe Puck (hexagonal backend + Next web app + worker + Telegram bot; events→sessions→occurrences). Update `rules/telegram-notifications.md` to Puck's own bot and `rules/supabase-wipe.md` to Puck's project. Keep the one intentional phrase "CandyStore-style permission system" where it documents the RBAC lineage.

- [ ] **Step 3: Verify no stray source references remain**

Run: `grep -rniE "candyshop|@monorepo" .claude || echo "clean"`
Expected: `clean` (or only intentional "CandyStore-style" matches from `grep -ri candystore`).
Run: `pnpm exec cspell ".claude/**/*.md" --no-progress`
Expected: PASS (add new words to `cspell.json` if needed).

- [ ] **Step 4: Commit**

```bash
git add .claude skills-lock.json
git commit -m "chore: port .claude rules, skills, agents, commands, docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 8: MCP servers (`.mcp.json` + `.claude/tools/*`)

**Files:**

- Create: `.claude/tools/*.mjs`, `.claude/tools/README.md`, `.claude/tools/.env.local.example`
- Create: `.mcp.json`
- Modify: `.gitignore` (ensure `.claude/tools/.env.local`)

**Interfaces:**

- Produces: MCP wrappers + a config that enables account-free servers now and leaves account-bound ones dormant.

- [ ] **Step 1: Copy wrappers**

Copy `Z:\Github\candystore\.claude\tools\*.mjs` and `README.md`. Create `.env.local.example` listing the token names (`GITHUB_PERSONAL_ACCESS_TOKEN`, `LINEAR_API_KEY`, `VERCEL_TOKEN`, `LOGROCKET_API_KEY`, `SLACK_*`) with empty values.

- [ ] **Step 2: Author `.mcp.json`**

```json
{
  "mcpServers": {
    "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] },
    "next-devtools": { "command": "npx", "args": ["next-devtools-mcp@latest"] },
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] },
    "github": {
      "command": "node",
      "args": [".claude/tools/github-unified-mcp.mjs"]
    },
    "git": { "command": "node", "args": [".claude/tools/git-mcp.mjs"] },
    "linear": "disabled",
    "slack": "disabled",
    "vercel": "disabled",
    "logrocket": "disabled",
    "github-setup": "disabled"
  }
}
```

(Match CandyStore's exact wrapper filenames; flip `"disabled"` → a real entry when Puck has the account.)

- [ ] **Step 3: Verify**

Run: `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('ok')"`
Expected: `ok`.
Run: `grep -rniE "candyshop|@monorepo" .claude/tools || echo clean`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json .claude/tools .gitignore
git commit -m "chore: port MCP wrappers and .mcp.json (account-free enabled)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 5 — CI/CD

### Task 9: Active workflows + change-detection scripts

**Files:**

- Create/Modify: `.github/workflows/ci.yml`, `pr-checks.yml`, `pr-freshness.yml`, `release.yml`, `notify-bug-issue.yml`
- Create: `scripts/detect-changes.sh`, `scripts/select-workspaces.sh`
- Create: `.github/CODEOWNERS`, issue/PR templates

**Interfaces:**

- Consumes: lint/test scripts.
- Produces: CI that runs format/lint/typecheck/test + PR validation, green on the empty repo.

- [ ] **Step 1: Read CandyStore workflows + scripts**

`Z:\Github\candystore\.github\workflows\{ci,pr-checks,pr-freshness,release,notify-bug-issue}.yml`, `\scripts\detect-changes.sh`, `\scripts\select-workspaces.sh`, `\.github\CODEOWNERS`, templates.

- [ ] **Step 2: Port `ci.yml` (genericized, runnable now)**

Keep jobs: changes-detection, quality (`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, monorepo checks `sherif`+`syncpack`), unit tests (`pnpm test`). Node 24, pnpm 10.32.1, pnpm cache. **Remove** Docker-build and E2E jobs (move to Task 11 as templates) so CI is green with no apps. Update the repo owner in any URLs to `vaoan/Puck`.

- [ ] **Step 3: Port `pr-checks.yml`**

Conventional-commit PR-title check; branch-target rules (main ← `release/*`,`fix/*`; develop ← others); security audit (`pnpm audit`, Semgrep `p/security-audit`+`p/owasp-top-ten`, `secretlint`). Gate a11y/visual steps behind "script exists" so they skip now.

- [ ] **Step 4: Port the rest + scripts (genericized)**

`pr-freshness.yml`, `release.yml` (`vYYYY.MM.DD.N` from `release/*` PRs), `notify-bug-issue.yml`. `detect-changes.sh`/`select-workspaces.sh` output generic flags driven by `apps/*`/`packages/*` globs, not hardcoded app names. Add `CODEOWNERS` (`* @vaoan` or as desired) and issue/PR templates.

- [ ] **Step 5: Verify workflows parse**

Run: `pnpm dlx actionlint` (or `actionlint` if installed) over `.github/workflows`.
Expected: no errors. If actionlint unavailable, validate YAML: `node -e "const y=require('fs');['ci','pr-checks','pr-freshness','release','notify-bug-issue'].forEach(f=>require('js-yaml').load(y.readFileSync('.github/workflows/'+f+'.yml','utf8')));console.log('ok')"` (install `js-yaml` transiently or use python `yaml`).
Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add .github scripts/detect-changes.sh scripts/select-workspaces.sh
git commit -m "ci: port CI, PR checks, release, and change-detection (generic)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 10: Deploy & maintenance workflow templates

**Files:**

- Create: `.github/workflows/{deploy-gcp,deploy-local,sandbox-release,backup-scheduled,sync-secrets}.yml`

**Interfaces:**

- Produces: parameterized deploy/maintenance workflows, clearly marked inactive until a deploy target is chosen.

- [ ] **Step 1: Read CandyStore deploy workflows**

`Z:\Github\candystore\.github\workflows\{deploy-gcp,deploy-local,sandbox-release,backup-scheduled,sync-secrets}.yml`.

- [ ] **Step 2: Port as templates**

Genericize; replace concrete project ids/secrets with placeholders. Neutralize triggers so they never fire by accident: set `on: workflow_dispatch` only and add a top comment `# TEMPLATE — wire when deploy target is chosen (spec §7)`. Remove `push: branches: [main]` triggers.

- [ ] **Step 3: Verify they parse and won't auto-run**

Run: the same YAML/actionlint check as Task 9 Step 5 over these files.
Expected: `ok`.
Confirm none contain `push:` or `schedule:` triggers (grep): `grep -nE "^\s*(push|schedule):" .github/workflows/{deploy-gcp,deploy-local,sandbox-release,backup-scheduled,sync-secrets}.yml || echo "no auto-triggers"`
Expected: `no auto-triggers`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: add deploy/maintenance workflow templates (dispatch-only)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 6 — Docker & infra templates

### Task 11: Docker, Supabase skeleton, infra scripts

**Files:**

- Create: `.dockerignore`, `docker/{ci,prod,infra}/*`
- Create: `supabase/config.toml.template`, `supabase/{migrations/.gitkeep,seed.sql,snippets/.gitkeep,tests/.gitkeep}`
- Create: `scripts/{docker-build.mjs,docker-teardown.mjs,docker-health-check.sh,supabase-cmd.mjs,supabase-docker.mjs}`

**Interfaces:**

- Produces: Docker/Supabase templates adapted for Node services + a Next app; nothing runs until apps exist.

- [ ] **Step 1: Read CandyStore docker + supabase + scripts**

`Z:\Github\candystore\docker\**`, `\supabase\config.toml.template`, `\scripts\{docker-build,docker-teardown,supabase-cmd,supabase-docker}.mjs`, `\scripts\docker-health-check.sh`.

- [ ] **Step 2: Port templates, adapt runtime shape**

Copy `docker/{ci,prod,infra}` and `.dockerignore`, genericized. In the Dockerfile templates, parameterize the build stages and add a header comment that Puck runs **Node services (Fastify API + worker + bot) plus a Next web app**, not only nginx-served Next. Mark app-specific stages `# fill per app when it lands`.

- [ ] **Step 3: Supabase skeleton**

Port `config.toml.template` (placeholders for project id/ports; expose `public`,`graphql_public` schemas; Postgres 17; migrations+seed enabled). Create empty `supabase/migrations/`, `snippets/`, `tests/` via `.gitkeep`, plus an empty `seed.sql`. Keep existing `supabase/config.toml`.

- [ ] **Step 4: Port helper scripts (genericized)**

`docker-build.mjs`, `docker-teardown.mjs`, `docker-health-check.sh`, `supabase-cmd.mjs`, `supabase-docker.mjs`.

- [ ] **Step 5: Verify**

Run: `node -e "console.log('scripts parse')" && for f in scripts/*.mjs; do node --check "$f"; done` (bash) — or PowerShell loop.
Expected: every `.mjs` passes `node --check`.
Run: `grep -rniE "candyshop|@monorepo" docker scripts supabase || echo clean`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add .dockerignore docker supabase scripts
git commit -m "chore: port Docker/Supabase templates and infra scripts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 7 — Repo meta finalize

### Task 12: Codegen template, vitest base, docs note, final verification

**Files:**

- Create: `orval.config.ts`, vitest base config (`vitest.config.ts` or `vitest.aliases.ts`)
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:**

- Produces: the remaining meta files and a verified, green boilerplate.

- [ ] **Step 1: Read CandyStore sources**

`Z:\Github\candystore\orval.config.ts`, `\vitest.aliases.ts`, `\vitest.config.scripts.js`.

- [ ] **Step 2: Port codegen + vitest base as templates**

`orval.config.ts` genericized with a `# wire when an OpenAPI source exists` comment (input pointed at a placeholder env var). Add a minimal root vitest config that discovers `scripts/**/*.test.mjs` now and will pick up workspace tests later.

- [ ] **Step 3: Update `README.md` / `CLAUDE.md`**

Add a short "Repo boilerplate" note to `README.md` (the rails are in place; `.secrets`/env resolver; `.claude` assistant layer) and a `CLAUDE.md` line pointing at this plan + the boilerplate spec. Keep the CandyStore-production safety warning verbatim.

- [ ] **Step 4: Full definition-of-done verification**

Run each and confirm:

- `pnpm install` → clean.
- `pnpm format:check` → PASS.
- `pnpm lint` → PASS.
- `pnpm check:tools` → PASS.
- `pnpm typecheck` → no-op PASS.
- `pnpm test` (or `pnpm exec vitest run`) → resolver tests PASS, no workspace tests.
- `pnpm exec secretlint "**/*"` → no findings.
- Workflows parse (Task 9 Step 5 check) → ok.
- `grep -rniE "candyshop|@monorepo" . --exclude-dir=node_modules --exclude-dir=.git || echo clean` → `clean`.

- [ ] **Step 5: Commit**

```bash
git add orval.config.ts vitest.config.ts README.md CLAUDE.md
git commit -m "chore: add codegen/vitest templates; document boilerplate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** §5A → Tasks 7–8; §5B → Tasks 2–4; §5C → Tasks 5–6; §5D → Tasks 9–10; §5E → Task 11; §5F → Tasks 1, 12. §6 divergences → Task 1 (tsconfig), Task 11 (runtime). §7 deferred decisions → Task 6 (envs: dev/ci/prod only), Task 8 (dormant MCP), Task 10 (deploy templates). §8 DoD → Task 12 Step 4. All covered.

**Placeholder scan:** No "TBD/TODO/handle edge cases". The `# wire when …` markers are intentional artifacts required by the spec (§3 principle 4), not plan gaps; each is paired with a concrete verification that the artifact is inert.

**Type consistency:** The only authored interface is `resolveEnv(envText, secrets)` (Task 5), used consistently in its own test; the CLI wrapper consumes it. No cross-task signature drift.

**Port-fidelity note:** Tasks that copy CandyStore files specify the exact source path + transform + a `grep` verification that no source identifiers leak — the authoritative content is the named source file, which is the correct specification for a port.
