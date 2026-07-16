# Puck Web App — Slice 1 (App Shell + Auth + Account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Progress (as of 2026-07-04):** Tasks **1–4 merged to `develop`** (PR #6,
> squash `d0256c2`). **Tasks 5–8 done on branch `feat/GH-5_Auth-Login-Account`**
> (all gates green: 13 unit tests, typecheck, lint, format; build passes when
> `NEXT_PUBLIC_SUPABASE_*` are provided — CI runs no build job): Task 5 OAuth login
> page + `SocialLoginButtons`, Task 6 OAuth callback route (safe-`next`), Task 7
> middleware (session refresh + `(app)` protection via `needsAuthRedirect`), Task 8
> app shell (Providers/Nav/AppShell + protected `(app)` layout). Also `fix(ui)`:
> switched `@puck/ui` internals from `@/` to the `@ui/*` alias so components resolve
> when consumed as source. **Task 9 (account domain + queries) is next.** Deferred:
> `[locale]/page.tsx → /account` redirect until the account route exists (Task 11).
> Remaining: Tasks 9–13 (account feature, E2E, docs/env sweep).

**Goal:** Stand up `apps/web` — a Next.js authoring app where an organizer logs in with Google/Discord, lands in a protected responsive shell, and views/edits their profile (`user_profiles`) under RLS — proving the whole stack (auth → Supabase → RLS → design system → tests) end-to-end.

**Architecture:** Next.js 16 App Router app talking **directly to Supabase** (the foundation's RLS + RPCs; no orval/REST). Mirrors CandyStore's `apps/auth` patterns, but **app-local** (Puck has one web app, so Supabase clients/i18n/tid live in `apps/web/src/shared/` rather than a shared package) and **middleware-level** route protection. Clean-architecture feature layout per `.claude/rules/architecture.md`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 + `@puck/ui` (shadcn), `next-intl` (en/es, `[locale]`-prefixed), `@supabase/ssr`, TanStack Query, zod + react-hook-form, Vitest + RTL, Playwright. Consumes `@puck/db` (types) + `@puck/auth` (catalog/helper).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-30-puck-web-shell-auth-design.md` — every task's requirements implicitly include it.
- **Reference project:** adapt from CandyStore at `Z:\Github\candystore` (esp. `apps/auth` + `packages/{api,ui,shared}`). Read the cited file before adapting. Never copy CandyStore branding/keys/business code.
- **Direct Supabase only.** No orval, no REST client, no Server Actions for data (CandyStore mutates via TanStack Query → browser client → RLS). Service-role key is **never** imported into `apps/web` runtime code (E2E fixtures only).
- **PII rule (from foundation `0013`):** `user_profiles` SELECT is column-scoped — an authenticated user **cannot** read `email`/`provider`. Profile reads select **only** `id, display_name, avatar_url, first_seen_at, last_seen_at, created_at, updated_at`. **Email is read from the auth session** (`getUser().email`), never from the table.
- **Editable profile fields:** `display_name`, `avatar_url` only.
- **Filenames:** kebab-case (components PascalCase per `naming-conventions.md`). ESM. Intra-app imports use `@/` → `src/`; workspace packages use bare scope `@puck/db`, `@puck/auth`, `@puck/ui`.
- **i18n:** `next-intl`, locales **en + es**, `[locale]`-prefixed routes. **No hardcoded user-facing strings** — every key exists in both `en.json` and `es.json` (`single-source-of-truth.md`).
- **Design tokens:** author from `docs/design/README.md` as OKLCH CSS variables (`tailwind.md`). Reuse Puck's iris brand — do NOT copy CandyStore's palette.
- **Tests:** TDD (failing test first). Supabase mocked at the client boundary via `vi.mock` (CandyStore pattern); MSW is available for any raw HTTP. E2E never clicks real OAuth — it seeds sessions. Selectors via `tid()`; no `toContainText`/`toHaveText` on translated copy (`e2e-selectors.md`).
- **Package manager:** pnpm 10, Node 24. New workspace deps via `pnpm --filter @puck/web add …` / `pnpm add -w …`.
- **DoD per the spec §3:** `pnpm typecheck` / `lint` / `format:check` / `test` (unit) + slice-1 Playwright E2E all green; new env vars in `.env.example` + README.

---

## File Structure

```
packages/ui/                         # NEW — @puck/ui (shadcn + Puck tokens)
  package.json, tsconfig.json
  src/index.ts
  src/utils/cn.ts
  src/components/{button,input,label,skeleton,card}.tsx
  src/styles/{globals.css,theme.css,base.css}   # Puck design tokens (OKLCH)

apps/web/                            # NEW — @puck/web
  package.json, tsconfig.json, next.config.ts, postcss.config.mjs
  vitest.config.mts, playwright.config.ts
  src/app/
    layout.tsx                       # root <html><body> + fonts
    globals.css                      # @import tailwindcss + @puck/ui globals + @source
    [locale]/
      layout.tsx                     # setRequestLocale + providers (intl, QueryClient, theme)
      page.tsx                       # redirect → /account (or marketing stub)
      login/page.tsx                 # public OAuth login
      (app)/
        layout.tsx                   # AppShell (nav) — protected group
        account/page.tsx             # thin wrapper → AccountPage
    auth/callback/route.ts           # exchangeCodeForSession (non-localized)
  src/features/account/
    domain/{types.ts,schema.ts,constants.ts}
    infrastructure/profile-queries.ts
    application/hooks/{useProfile.ts,useUpdateProfile.ts}
    presentation/{AccountPage.tsx,ProfileForm.tsx}
  src/shared/
    infrastructure/
      supabase/{browser-client.ts,server-client.ts,cookies.ts,config.ts}
      i18n/{index.ts,request.ts,messages/en.json,messages/es.json}
      config/{env.ts,tid.ts}
    application/hooks/{useSupabase.ts,useAuth.ts}
    presentation/{AppShell.tsx,Nav.tsx,SocialLoginButtons.tsx,Providers.tsx,SignOutButton.tsx}
  src/test/{setup.ts,render.tsx}
  src/mocks/{handlers.ts,server.ts}
  middleware.ts
  e2e/
    fixtures/auth.fixture.ts
    helpers/session.ts
    tests/{auth-redirect,account}.spec.ts
```

---

## Task 1: Scaffold `apps/web` + test harness + smoke test

**Files:**

- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/vitest.config.mts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/shared/infrastructure/config/tid.ts`, `apps/web/src/test/setup.ts`, `apps/web/src/test/render.tsx`, `apps/web/src/app/[locale]/page.test.tsx`
- Modify: root `pnpm-workspace.yaml` already globs `apps/*` (verify), root `tsconfig.json`/`tsconfig.base.json` paths if a workspace ref list exists.

**Interfaces:**

- Produces: the `@puck/web` workspace; `tid(id: string): { 'data-testid'?: string }`; `renderWithProviders(ui)` test util; the locale layout shell.

- [x] **Step 1: Create the package + install deps**

`apps/web/package.json` (adapt versions from `candystore/apps/auth/package.json` — Next 16.2.x, React 19.2.x):

```json
{
  "name": "@puck/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 5000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

Run:

```bash
pnpm --filter @puck/web add next@16 react@19 react-dom@19 @supabase/ssr @supabase/supabase-js next-intl @tanstack/react-query zod react-hook-form @hookform/resolvers lucide-react
pnpm --filter @puck/web add @puck/db@workspace:* @puck/auth@workspace:* @puck/ui@workspace:*
pnpm --filter @puck/web add -D typescript @types/react @types/react-dom @types/node tailwindcss @tailwindcss/postcss tw-animate-css vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test msw
```

Expected: installs; `@puck/ui` will not resolve until Task 2 creates it — that's fine for now (it's referenced, created next). If install hard-fails on the missing `@puck/ui`, temporarily omit it here and add it at the end of Task 2.

- [x] **Step 2: tsconfig + next.config + postcss**

`apps/web/tsconfig.json` (extend base; aliases mirror `candystore/apps/auth/tsconfig.json`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@puck/ui": ["../../packages/ui/src"],
      "@puck/ui/*": ["../../packages/ui/src/*"],
      "@puck/db": ["../../packages/db/src"],
      "@puck/auth": ["../../packages/auth/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts` (adapt from `candystore/apps/auth/next.config.ts`, dropping Sentry/standalone/rewrites for now):

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(
  "./src/shared/infrastructure/i18n/request.ts",
);

const nextConfig: NextConfig = {
  transpilePackages: ["@puck/ui", "@puck/db", "@puck/auth"],
};

export default withNextIntl(nextConfig);
```

`apps/web/postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

- [x] **Step 3: Root layout + globals + locale layout + placeholder page**

`apps/web/src/app/layout.tsx`:

```tsx
import "@/app/globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children; // the [locale]/layout renders <html>; root just imports globals
}
```

> Note: with `[locale]` routing, the `<html>`/`<body>` is rendered in `[locale]/layout.tsx`. Keep this root layout minimal.

`apps/web/src/app/globals.css` (the `@puck/ui` globals are authored in Task 2; this references them):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@puck/ui/globals";

@source "../**/*.{ts,tsx}";
@source "../../../../packages/ui/src/**/*.{ts,tsx}";
```

`apps/web/src/app/[locale]/layout.tsx` (providers added in later tasks; start minimal but valid):

```tsx
import { setRequestLocale } from "next-intl/server";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/[locale]/page.tsx`:

```tsx
import { tid } from "@/shared/infrastructure/config/tid";

export default function HomePage() {
  return <main {...tid("home")}>Puck</main>;
}
```

- [x] **Step 4: tid() util + test harness**

`apps/web/src/shared/infrastructure/config/tid.ts` (simplified from `candystore/packages/shared/src/utils/tid.ts`):

```ts
export function tid(id: string): Record<string, string> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_IDS !== "true"
  ) {
    return {};
  }
  return { "data-testid": id };
}
```

`apps/web/vitest.config.mts` (adapt from `candystore/apps/auth/vitest.config.mts`):

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@puck/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@puck/db": path.resolve(__dirname, "../../packages/db/src"),
      "@puck/auth": path.resolve(__dirname, "../../packages/auth/src"),
    },
  },
});
```

`apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`apps/web/src/test/render.tsx` (a provider-wrapping render; QueryClient added now, intl/theme later):

```tsx
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}
```

- [x] **Step 5: Write the smoke test (RED)**

`apps/web/src/app/[locale]/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the home test-id", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });
});
```

- [x] **Step 6: Run RED → implement is already in place → GREEN**

Run: `pnpm --filter @puck/web test`
Expected: GREEN (page + tid + harness all present). If RED, fix the failing import/path before proceeding.

- [x] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold apps/web + vitest harness + smoke test [GH-5]"
```

---

## Task 2: `packages/ui` — `@puck/ui` with Puck design tokens + base components

**Files:**

- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`, `packages/ui/src/utils/cn.ts`, `packages/ui/src/utils/cn.test.ts`, `packages/ui/src/components/{button,input,label,skeleton,card}.tsx`, `packages/ui/src/components/button.test.tsx`, `packages/ui/src/styles/{globals.css,theme.css,base.css}`

**Interfaces:**

- Produces: `cn(...inputs)`, `Button`, `Input`, `Label`, `Skeleton`, `Card` from `@puck/ui`; the `@puck/ui/globals` stylesheet (Puck tokens).

- [x] **Step 1: Package shell + cn (RED test first)**

`packages/ui/package.json`:

```json
{
  "name": "@puck/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./globals": "./src/styles/globals.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  }
}
```

Install: `pnpm --filter @puck/ui add clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-slot @radix-ui/react-label` and `pnpm --filter @puck/ui add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom react react-dom typescript`.

`packages/ui/src/utils/cn.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cn } from "./cn";
describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe(
      "text-sm font-bold",
    );
  });
});
```

Run `pnpm --filter @puck/ui test` → RED (no `./cn`). Then `packages/ui/src/utils/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Run → GREEN.

- [x] **Step 2: Author Puck design tokens (`styles/`)**

Translate `docs/design/README.md` tokens to OKLCH. `packages/ui/src/styles/theme.css` declares `:root` + `.dark` CSS variables and an `@theme inline` block mapping `--color-*` to them. Use the README's iris brand + functional palette. Minimum token set needed by slice 1:

```css
@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.99 0.004 95); /* warm off-white --canvas */
  --foreground: oklch(0.21 0.03 280); /* --ink indigo-black */
  --muted: oklch(0.96 0.01 280);
  --muted-foreground: oklch(0.45 0.02 280);
  --card: oklch(1 0 0);
  --border: oklch(0.92 0.01 280);
  --brand: oklch(0.5 0.2 277); /* iris */
  --brand-foreground: oklch(0.99 0 0);
  --destructive: oklch(0.58 0.22 27);
  --ring: oklch(0.5 0.2 277);
  --radius: 0.875rem; /* inputs ~14px; cards 20px via radius-lg */
}
.dark {
  --background: oklch(0.18 0.02 280);
  --foreground: oklch(0.96 0.01 280);
  /* …dark equivalents, contrast-checked per tailwind.md WCAG rules… */
}
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-destructive: var(--destructive);
  --radius-lg: calc(var(--radius) + 0.375rem);
}
```

`packages/ui/src/styles/base.css`:

```css
@layer base {
  * {
    border-color: var(--border);
  }
  body {
    background: var(--background);
    color: var(--foreground);
  }
}
```

`packages/ui/src/styles/globals.css`:

```css
@import "./theme.css";
@import "./base.css";
```

> Verify WCAG contrast (`tailwind.md`) for `foreground`/`background`, `brand`/`brand-foreground`, `muted`/`muted-foreground` in BOTH `:root` and `.dark`.

- [x] **Step 3: Base components (Button with RED test, then Input/Label/Skeleton/Card)**

`packages/ui/src/components/button.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";
describe("Button", () => {
  it("renders children and applies brand variant by default", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-brand");
  });
});
```

Run → RED. Then `packages/ui/src/components/button.tsx` (CVA, adapt from `candystore/packages/ui/src/components/button.tsx` but with Puck variants):

```tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand/90",
        outline: "border border-border bg-card hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive:
          "bg-destructive text-brand-foreground hover:bg-destructive/90",
      },
      size: { default: "h-10 px-4", sm: "h-9 px-3", lg: "h-12 px-6" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

> Note `@/` inside `@puck/ui` maps to `packages/ui/src` — add `"@/*": ["./src/*"]` to `packages/ui/tsconfig.json` paths.

Add `Input`, `Label` (Radix), `Skeleton`, `Card` as small presentational components (one per file). `packages/ui/src/index.ts` re-exports all + `cn`. Run `pnpm --filter @puck/ui test` → GREEN.

- [x] **Step 4: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): @puck/ui — Puck design tokens (OKLCH) + base shadcn components [GH-5]"
```

---

## Task 3: Supabase clients + env config (app-local)

**Files:**

- Create: `apps/web/src/shared/infrastructure/supabase/{config.ts,cookies.ts,browser-client.ts,server-client.ts}`, `apps/web/src/shared/infrastructure/config/env.ts`, `apps/web/src/shared/infrastructure/supabase/config.test.ts`

**Interfaces:**

- Consumes: `Database` from `@puck/db`.
- Produces: `createBrowserSupabaseClient(): SupabaseClient<Database>`, `createServerSupabaseClient(): Promise<SupabaseClient<Database>>`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_COOKIE_KEY`.

- [x] **Step 1: env + config (RED test on cookie-key derivation)**

`apps/web/src/shared/infrastructure/config/env.ts`:

```ts
import { z } from "zod";
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});
export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
```

`apps/web/src/shared/infrastructure/supabase/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveProjectRef } from "./config";
describe("deriveProjectRef", () => {
  it("extracts the project ref from a supabase url", () => {
    expect(deriveProjectRef("https://abcdxyz.supabase.co")).toBe("abcdxyz");
    expect(deriveProjectRef("http://localhost:54321")).toBe("localhost");
  });
});
```

Run → RED. Then `apps/web/src/shared/infrastructure/supabase/config.ts` (adapt `candystore/packages/api/src/supabase/config.ts`):

```ts
import { env } from "@/shared/infrastructure/config/env";
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export function deriveProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0];
}
export const SUPABASE_COOKIE_KEY = `sb-${deriveProjectRef(SUPABASE_URL)}-auth-token`;
```

Run → GREEN.

- [x] **Step 2: cookies + clients (adapt CandyStore, drop multi-app domain)**

`apps/web/src/shared/infrastructure/supabase/cookies.ts` — localhost-friendly merge (no shared root domain; `secure` only in prod):

```ts
import type { CookieOptions } from "@supabase/ssr";
export function mergeSupabaseCookieOptions(
  options: CookieOptions,
): CookieOptions {
  return { ...options, secure: process.env.NODE_ENV === "production" };
}
```

`apps/web/src/shared/infrastructure/supabase/browser-client.ts` (singleton, adapt `candystore/packages/api/src/supabase/browser.ts`):

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@puck/db";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_KEY } from "./config";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function createBrowserSupabaseClient() {
  if (client) return client;
  client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
  });
  return client;
}
```

`apps/web/src/shared/infrastructure/supabase/server-client.ts` (adapt `candystore/packages/api/src/supabase/server.ts`):

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@puck/db";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_KEY } from "./config";
import { mergeSupabaseCookieOptions } from "./cookies";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet)
            cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
        } catch {
          /* called from a Server Component — ignore */
        }
      },
    },
  });
}
```

- [ ] **Step 3: Run + commit**
      Run: `pnpm --filter @puck/web test` (config test green; clients typecheck). Then:

```bash
git add apps/web && git commit -m "feat(web): app-local supabase browser/server clients + env [GH-5]"
```

---

## Task 4: i18n (next-intl, `[locale]`, en/es)

**Files:**

- Create: `apps/web/src/shared/infrastructure/i18n/{index.ts,request.ts}`, `apps/web/src/shared/infrastructure/i18n/messages/{en.json,es.json}`, `apps/web/src/shared/infrastructure/i18n/i18n.test.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx` (wrap `NextIntlClientProvider`)

**Interfaces:**

- Produces: `routing` (locales `["en","es"]`, default `en`), localized `Link`/`redirect`/`usePathname`/`useRouter`; message namespaces `common`, `auth`, `account`, `nav`.

- [x] **Step 1: routing + request + messages**

`apps/web/src/shared/infrastructure/i18n/index.ts`:

```ts
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
});
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

`apps/web/src/shared/infrastructure/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./index";
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "en" | "es"))
    locale = routing.defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

`messages/en.json` (and a Spanish `es.json` with the SAME keys):

```json
{
  "common": {
    "loading": "Loading…",
    "save": "Save",
    "saved": "Saved",
    "error": "Something went wrong"
  },
  "auth": {
    "login": {
      "title": "Sign in to Puck",
      "google": "Continue with Google",
      "discord": "Continue with Discord"
    },
    "signOut": "Sign out"
  },
  "account": {
    "title": "Account",
    "displayName": "Display name",
    "avatarUrl": "Avatar URL",
    "email": "Email"
  },
  "nav": { "account": "Account" }
}
```

- [x] **Step 2: Wrap provider + RED test**

Update `[locale]/layout.tsx` to fetch messages (`getMessages()`) and wrap children in `<NextIntlClientProvider messages={messages}>` (keep the `<html>`/`<body>`).

`apps/web/src/shared/infrastructure/i18n/i18n.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useTranslations } from "next-intl";
import en from "./messages/en.json";

function Probe() {
  const t = useTranslations("auth.login");
  return <span>{t("google")}</span>;
}
describe("i18n", () => {
  it("resolves a translation key", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Probe />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });
});
```

Run `pnpm --filter @puck/web test` → GREEN.

- [ ] **Step 3: Verify key parity + commit**
      Run a quick check that `en.json` and `es.json` have identical key sets (eyeball or `node -e` deep-key diff). Commit:

```bash
git add apps/web && git commit -m "feat(web): next-intl i18n (en/es, locale-prefixed) [GH-5]"
```

---

## Task 5: OAuth login page + `SocialLoginButtons`

**Files:**

- Create: `apps/web/src/shared/application/hooks/useSupabase.ts`, `apps/web/src/shared/application/hooks/useAuth.ts`, `apps/web/src/shared/presentation/SocialLoginButtons.tsx`, `apps/web/src/shared/presentation/SocialLoginButtons.test.tsx`, `apps/web/src/app/[locale]/login/page.tsx`

**Interfaces:**

- Consumes: `createBrowserSupabaseClient`.
- Produces: `useSupabase()`; `useAuth()` → `{ user, signInWithProvider(provider, redirectTo?), signOut() }`; `<SocialLoginButtons returnTo?>`.

- [x] **Step 1: hooks**
      `useSupabase.ts`:

```ts
import { useMemo } from "react";
import { createBrowserSupabaseClient } from "@/shared/infrastructure/supabase/browser-client";
export function useSupabase() {
  return useMemo(() => createBrowserSupabaseClient(), []);
}
```

`useAuth.ts` (adapt `candystore/packages/auth/src/client/useAuth.ts`):

```ts
"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useSupabase } from "./useSupabase";

export function useAuth() {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signInWithProvider(
    provider: "google" | "discord",
    redirectTo?: string,
  ) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo ?? `${globalThis.location.origin}/auth/callback`,
      },
    });
  }
  async function signOut() {
    await supabase.auth.signOut();
  }
  return { user, signInWithProvider, signOut };
}
```

- [x] **Step 2: RED test for SocialLoginButtons**
      `SocialLoginButtons.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInWithProvider = vi.fn();
vi.mock("@/shared/application/hooks/useAuth", () => ({
  useAuth: () => ({ signInWithProvider, user: null, signOut: vi.fn() }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { SocialLoginButtons } from "./SocialLoginButtons";

describe("SocialLoginButtons", () => {
  beforeEach(() => signInWithProvider.mockClear());
  it("calls signInWithProvider('google', …/auth/callback) on click", async () => {
    render(<SocialLoginButtons />);
    await userEvent.click(screen.getByTestId("login-google"));
    expect(signInWithProvider).toHaveBeenCalledWith(
      "google",
      expect.stringContaining("/auth/callback"),
    );
  });
});
```

Run → RED.

- [x] **Step 3: Implement + login page**
      `SocialLoginButtons.tsx` (adapt `candystore/.../SocialLoginButtons.tsx`):

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Button } from "@puck/ui";
import { tid } from "@/shared/infrastructure/config/tid";
import { useAuth } from "@/shared/application/hooks/useAuth";

export function SocialLoginButtons({ returnTo = "/" }: { returnTo?: string }) {
  const t = useTranslations("auth.login");
  const { signInWithProvider } = useAuth();
  const go = (p: "google" | "discord") =>
    signInWithProvider(
      p,
      `${globalThis.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
    );
  return (
    <div className="flex flex-col gap-3">
      <Button {...tid("login-google")} onClick={() => go("google")}>
        {t("google")}
      </Button>
      <Button
        {...tid("login-discord")}
        variant="outline"
        onClick={() => go("discord")}
      >
        {t("discord")}
      </Button>
    </div>
  );
}
```

`[locale]/login/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { SocialLoginButtons } from "@/shared/presentation/SocialLoginButtons";
import { tid } from "@/shared/infrastructure/config/tid";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6"
      {...tid("login")}
    >
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <SocialLoginButtons />
    </main>
  );
}
```

Run `pnpm --filter @puck/web test` → GREEN.

- [ ] **Step 4: Commit**

```bash
git add apps/web && git commit -m "feat(web): OAuth login page + social buttons (google/discord) [GH-5]"
```

---

## Task 6: OAuth callback route

**Files:**

- Create: `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/app/auth/callback/route.test.ts`

**Interfaces:**

- Consumes: `createServerSupabaseClient`.
- Produces: `GET(request)` → exchanges `?code` for a session, redirects to a safe `?next` (default `/en/account`).

- [x] **Step 1: RED test**
      `route.test.ts` (mock the server client + `next/server`):

```ts
import { describe, it, expect, vi } from "vitest";

const exchange = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/shared/infrastructure/supabase/server-client", () => ({
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession: exchange },
  }),
}));

import { GET } from "./route";

describe("oauth callback", () => {
  it("exchanges the code and redirects to next", async () => {
    const req = new Request(
      "http://localhost:5000/auth/callback?code=abc&next=/en/account",
    );
    const res = await GET(req as never);
    expect(exchange).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toContain("/en/account");
  });
});
```

Run → RED.

- [x] **Step 2: Implement (adapt `candystore/packages/api/src/supabase/callback.ts`, simplified)**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/shared/infrastructure/supabase/server-client";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/en/account";
}
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/en/login", url.origin));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(new URL("/en/login?error=auth", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
```

Run → GREEN.

- [ ] **Step 3: Commit**

```bash
git add apps/web && git commit -m "feat(web): OAuth callback route (exchangeCodeForSession) [GH-5]"
```

---

## Task 7: Middleware — session refresh + `(app)` route protection

**Files:**

- Create: `apps/web/middleware.ts`, `apps/web/src/shared/infrastructure/supabase/middleware-session.ts`, `apps/web/src/shared/infrastructure/supabase/middleware-session.test.ts`

**Interfaces:**

- Produces: middleware that refreshes the Supabase session, runs next-intl, and redirects unauthenticated requests for `(app)` paths to `/<locale>/login?returnTo=…`.

- [x] **Step 1: protection-decision unit (RED)**
      Extract the pure decision so it's testable. `middleware-session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { needsAuthRedirect } from "./middleware-session";
describe("needsAuthRedirect", () => {
  it("protects account, ignores login/public", () => {
    expect(needsAuthRedirect("/en/account", false)).toBe(true);
    expect(needsAuthRedirect("/en/account", true)).toBe(false);
    expect(needsAuthRedirect("/en/login", false)).toBe(false);
    expect(needsAuthRedirect("/en", false)).toBe(false);
  });
});
```

Run → RED.

- [x] **Step 2: Implement decision + middleware**
      `middleware-session.ts`:

```ts
const PROTECTED = ["/account"]; // (app) group routes; extend per slice
export function needsAuthRedirect(
  pathname: string,
  hasSession: boolean,
): boolean {
  if (hasSession) return false;
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return PROTECTED.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(`${p}/`),
  );
}
```

`apps/web/middleware.ts` (compose session refresh + intl; adapt the `updateSession` shape from `candystore/packages/api/src/supabase/proxy.ts`, and next-intl middleware):

```ts
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/shared/infrastructure/i18n";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_KEY,
} from "@/shared/infrastructure/supabase/config";
import { needsAuthRedirect } from "@/shared/infrastructure/supabase/middleware-session";

const intl = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const res = intl(request);
  // refresh session, mirroring cookies onto the intl response
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) =>
        toSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options),
        ),
    },
  });
  const { data } = await supabase.auth.getUser();
  if (needsAuthRedirect(request.nextUrl.pathname, !!data.user)) {
    const locale =
      request.nextUrl.pathname.split("/")[1] || routing.defaultLocale;
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}
export const config = {
  matcher: ["/((?!_next|api|auth/callback|.*\\..*).*)"],
};
```

Run `pnpm --filter @puck/web test` → GREEN (the decision unit; full redirect behavior is covered by E2E in Task 12).

- [ ] **Step 3: Commit**

```bash
git add apps/web && git commit -m "feat(web): middleware — session refresh + (app) route protection [GH-5]"
```

---

## Task 8: App shell (protected `(app)` layout + nav + providers)

**Files:**

- Create: `apps/web/src/shared/presentation/{Providers.tsx,AppShell.tsx,Nav.tsx}`, `apps/web/src/shared/presentation/AppShell.test.tsx`, `apps/web/src/app/[locale]/(app)/layout.tsx`, `apps/web/src/app/[locale]/page.tsx` (update → redirect to `/account`)

**Interfaces:**

- Consumes: i18n `Link`, `tid`.
- Produces: `<Providers>` (QueryClientProvider), `<AppShell>` (responsive nav frame), the protected `(app)` layout.

- [x] **Step 1: RED test for AppShell**
      `AppShell.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/shared/infrastructure/i18n", () => ({
  Link: (p: any) => <a {...p} />,
}));
import { AppShell } from "./AppShell";
describe("AppShell", () => {
  it("renders nav + children", () => {
    render(
      <AppShell>
        <div data-testid="content" />
      </AppShell>,
    );
    expect(screen.getByTestId("app-nav")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
```

Run → RED.

- [x] **Step 2: Implement Providers, Nav, AppShell, layout** _(page.tsx → /account redirect deferred to Task 11, when the account route exists)_
      `Providers.tsx` (`"use client"`, a `QueryClientProvider` with a stable client via `useState`). `Nav.tsx` (responsive top/bottom nav using `@puck/ui` + the design tokens; one item — Account — with `{...tid("app-nav")}` on the nav and `tid("nav-account")` on the link; uses i18n `Link` + `useTranslations("nav")`). `AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { Nav } from "./Nav";
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Nav />
      <main className="mx-auto max-w-3xl p-4 md:p-6">{children}</main>
    </div>
  );
}
```

`[locale]/(app)/layout.tsx`:

```tsx
import { Providers } from "@/shared/presentation/Providers";
import { AppShell } from "@/shared/presentation/AppShell";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
```

Update `[locale]/page.tsx` to `redirect("/account")` (localized redirect from `@/shared/infrastructure/i18n`). Run → GREEN.

- [ ] **Step 3: Commit**

```bash
git add apps/web && git commit -m "feat(web): responsive app shell + providers + protected (app) layout [GH-5]"
```

---

## Task 9: Account feature — domain + infrastructure

**Files:**

- Create: `apps/web/src/features/account/domain/{types.ts,schema.ts,constants.ts}`, `apps/web/src/features/account/infrastructure/profile-queries.ts`, `apps/web/src/features/account/infrastructure/profile-queries.test.ts`

**Interfaces:**

- Consumes: `Database` from `@puck/db`, a `SupabaseClient`.
- Produces: `Profile` (id, display_name, avatar_url, timestamps — **no email/provider**); `profileFormSchema` + `ProfileFormValues`; `fetchProfile(supabase, userId): Promise<Profile>`; `updateProfile(supabase, userId, values): Promise<Profile>`; `PROFILE_QUERY_KEY`.

- [x] **Step 1: domain types + schema + constants** _(added `schema.test.ts` — RED-first coverage for the zod transforms/https validation, beyond the plan)_
      `domain/types.ts`:

```ts
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}
```

`domain/schema.ts`:

```ts
import { z } from "zod";
export const profileFormSchema = z.object({
  display_name: z
    .string()
    .max(100)
    .optional()
    .transform((v) => v?.trim() || null),
  avatar_url: z
    .string()
    .url()
    .startsWith("https://")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : null)),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type ProfileFormInput = z.input<typeof profileFormSchema>;
```

`domain/constants.ts`:

```ts
export const PROFILE_QUERY_KEY = "profile";
export const PROFILE_STALE_TIME_MS = 30_000;
```

- [x] **Step 2: RED test for profile-queries (column-scoped select)** _(added `updateProfile` + error-path cases too)_
      `profile-queries.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchProfile, PROFILE_COLUMNS } from "./profile-queries";

function fakeSupabase(row: unknown) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, select, from };
}

describe("fetchProfile", () => {
  it("selects ONLY the non-PII columns from user_profiles", async () => {
    const { client, from, select } = fakeSupabase({
      id: "u1",
      display_name: "A",
    });
    const out = await fetchProfile(client, "u1");
    expect(from).toHaveBeenCalledWith("user_profiles");
    expect(select).toHaveBeenCalledWith(PROFILE_COLUMNS);
    expect(PROFILE_COLUMNS).not.toContain("email");
    expect(out.id).toBe("u1");
  });
});
```

Run → RED.

- [x] **Step 3: Implement (adapt `candystore/.../account/infrastructure/profileQueries.ts`, but column-scoped — never `select("*")`)** _(GREEN — 10/10 tests pass, `pnpm --filter @puck/web typecheck` clean)_
      `infrastructure/profile-queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@puck/db";
import type { Profile } from "../domain/types";
import type { ProfileFormValues } from "../domain/schema";

// PII rule: email/provider are NOT readable by authenticated users (foundation 0013).
export const PROFILE_COLUMNS =
  "id, display_name, avatar_url, first_seen_at, last_seen_at, created_at, updated_at";

export async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  values: ProfileFormValues,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("user_profiles")
    .update(values)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as Profile;
}
```

Run → GREEN.

- [ ] **Step 4: Commit**

```bash
git add apps/web && git commit -m "feat(web): account domain + column-scoped profile queries [GH-5]"
```

---

## Task 10: Account feature — application hooks

**Files:**

- Create: `apps/web/src/features/account/application/hooks/{useProfile.ts,useUpdateProfile.ts}`, `apps/web/src/features/account/application/hooks/useProfile.test.tsx`

**Interfaces:**

- Consumes: `useSupabase`, `fetchProfile`/`updateProfile`, `PROFILE_QUERY_KEY`.
- Produces: `useProfile(userId?)` (TanStack `useQuery`), `useUpdateProfile(userId)` (`useMutation`, invalidates the profile query).

- [x] **Step 1: RED test for useProfile (mock supabase module + query wrapper)** _(also covers the `enabled:false` disabled path + `useUpdateProfile` mutation)_
      `useProfile.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/application/hooks/useSupabase", () => ({
  useSupabase: () => ({}),
}));
vi.mock("@/features/account/infrastructure/profile-queries", () => ({
  fetchProfile: vi
    .fn()
    .mockResolvedValue({ id: "u1", display_name: "A", avatar_url: null }),
  PROFILE_QUERY_KEY: "profile",
}));
import { useProfile } from "./useProfile";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("useProfile", () => {
  it("loads the profile for a user id", async () => {
    const { result } = renderHook(() => useProfile("u1"), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("u1"));
  });
});
```

Run → RED.

- [x] **Step 2: Implement (adapt CandyStore hooks)** _(GREEN — 13/13 account tests, typecheck clean)_
      `useProfile.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/shared/application/hooks/useSupabase";
import { fetchProfile } from "@/features/account/infrastructure/profile-queries";
import {
  PROFILE_QUERY_KEY,
  PROFILE_STALE_TIME_MS,
} from "@/features/account/domain/constants";
export function useProfile(userId: string | undefined) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY, userId],
    queryFn: () => fetchProfile(supabase, userId!),
    enabled: !!userId,
    staleTime: PROFILE_STALE_TIME_MS,
  });
}
```

`useUpdateProfile.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/shared/application/hooks/useSupabase";
import { updateProfile } from "@/features/account/infrastructure/profile-queries";
import { PROFILE_QUERY_KEY } from "@/features/account/domain/constants";
import type { ProfileFormValues } from "@/features/account/domain/schema";
export function useUpdateProfile(userId: string) {
  const supabase = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateProfile(supabase, userId, values),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY, userId] }),
  });
}
```

Run → GREEN.

- [ ] **Step 3: Commit**

```bash
git add apps/web && git commit -m "feat(web): account application hooks (useProfile/useUpdateProfile) [GH-5]"
```

---

## Task 11: Account feature — presentation + route

**Files:**

- Create: `apps/web/src/features/account/presentation/{ProfileForm.tsx,AccountPage.tsx}`, `apps/web/src/features/account/presentation/ProfileForm.test.tsx`, `apps/web/src/shared/presentation/SignOutButton.tsx`, `apps/web/src/app/[locale]/(app)/account/page.tsx`

**Interfaces:**

- Consumes: `useAuth` (user + signOut), `useProfile`, `useUpdateProfile`, `profileFormSchema`, `@puck/ui`.
- Produces: `<AccountPage>` (email read-only from session + the form + sign-out), `<ProfileForm>`.

- [x] **Step 1: RED test for ProfileForm (validation + submit)** _(also asserts non-https avatar blocks submit; added a TDD'd `SignOutButton.test.tsx` for the sign-out→redirect behavior)_
      `ProfileForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
import { ProfileForm } from "./ProfileForm";

describe("ProfileForm", () => {
  it("submits trimmed display_name", async () => {
    const onSubmit = vi.fn();
    render(
      <ProfileForm
        profile={{ id: "u1", display_name: "Old", avatar_url: null } as never}
        onSubmit={onSubmit}
        isPending={false}
        isSuccess={false}
        isError={false}
      />,
    );
    const input = screen.getByTestId("profile-display-name");
    await userEvent.clear(input);
    await userEvent.type(input, "  New Name  ");
    await userEvent.click(screen.getByTestId("profile-save"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "New Name" }),
    );
  });
});
```

Run → RED.

- [x] **Step 2: Implement ProfileForm, AccountPage, SignOutButton, route** _(GREEN — 29/29 web tests, typecheck + lint + prettier clean. Note: `ProfileForm` wraps `handleSubmit((v) => onSubmit(v))` so RHF's event never leaks into `mutate`'s options.)_
      **Deferred redirect resolved (Option A — keep middleware):** home `[locale]/page.tsx` now `redirect({ href: "/account", locale })` via next-intl (server component), as the interim landing until the events-dashboard slice replaces it (mirrors CandyStore admin's Dashboard-at-root). Its smoke test was rewritten from `tid("home")` to assert the redirect. Puck's merged middleware protection is retained — CandyStore's no-middleware layout-guard was considered and declined to avoid re-architecting merged tasks 5–8.
      `ProfileForm.tsx` (react-hook-form + zodResolver; `z.input`→`z.output` generics like CandyStore; `@puck/ui` `Input`/`Label`/`Button`; `{...tid("profile-display-name")}`, `{...tid("profile-save")}`; uses `useTranslations("account")`).
      `AccountPage.tsx` (`"use client"`):

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useAuth } from "@/shared/application/hooks/useAuth";
import { useProfile } from "@/features/account/application/hooks/useProfile";
import { useUpdateProfile } from "@/features/account/application/hooks/useUpdateProfile";
import { ProfileForm } from "./ProfileForm";
import { SignOutButton } from "@/shared/presentation/SignOutButton";
import { Skeleton } from "@puck/ui";
import { tid } from "@/shared/infrastructure/config/tid";

export function AccountPage() {
  const t = useTranslations("account");
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const update = useUpdateProfile(user?.id ?? "");
  return (
    <section className="flex flex-col gap-6" {...tid("account")}>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">
        {t("email")}: {user?.email ?? "—"}
      </p>
      {isLoading || !profile ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <ProfileForm
          profile={profile}
          onSubmit={update.mutate}
          isPending={update.isPending}
          isSuccess={update.isSuccess}
          isError={update.isError}
        />
      )}
      <SignOutButton />
    </section>
  );
}
```

> **PII rule lives here:** email comes from `user.email` (session), NOT from `profile`.
> `SignOutButton.tsx` (`"use client"`; calls `useAuth().signOut()` then `redirect("/login")`). `[locale]/(app)/account/page.tsx`:

```tsx
import { AccountPage } from "@/features/account/presentation/AccountPage";
export default function Page() {
  return <AccountPage />;
}
```

Run `pnpm --filter @puck/web test` → GREEN.

- [ ] **Step 3: Commit**

```bash
git add apps/web && git commit -m "feat(web): account page (session email + profile form + sign-out) [GH-5]"
```

---

## Task 12: Playwright E2E — protected redirect + seeded-session account edit + a11y

**Files:**

- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/helpers/session.ts`, `apps/web/e2e/fixtures/auth.fixture.ts`, `apps/web/e2e/tests/auth-redirect.spec.ts`, `apps/web/e2e/tests/account.spec.ts`
- Modify: `.env.example` (add `SUPABASE_SERVICE_ROLE_KEY` for E2E only)

**Interfaces:**

- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the running app + local Supabase.
- Produces: an `authenticatedPage` fixture seeding a real session via cookies.

> **Bugs the E2E surfaced (all fixed in this task — none were caught by unit/typecheck/lint, and CI has no build job):**
>
> 1. **Middleware never ran.** It lived at `apps/web/middleware.ts`, but the app is under `src/`, so Next ignored it — `/account` was fully unprotected. Next 16 also renamed the convention `middleware`→`proxy`, so it's now `apps/web/src/proxy.ts` exporting `proxy`.
> 2. **`export const config = { matcher }` broke `next build`** ("Invalid segment configuration export") AND caused next-intl to run on `/_next/*` requests → assets 404'd at `/en/_next/*` → **no client JS → no hydration → the account form never loaded**. Fixed by dropping the `config` export and filtering excluded paths inside `proxy()`.
> 3. **Bare `/` returned 404** — added `app/page.tsx` → `/{defaultLocale}` (CandyStore-style, TDD'd).
> 4. **No `<title>`** (WCAG 2.4.2 a11y fail) — added i18n `generateMetadata` (`meta` namespace, en/es).
> 5. **eslint `boundaries` config** registered `proxy.ts` without `mode: "file"`, so it flagged the file — fixed in `eslint.config.mjs`.

- [x] **Step 1: Playwright config + session helper (adapt `candystore/apps/auth/e2e/**`)** _(single chromium project, `webServer: pnpm dev`, health check on `/en/login`; simplified session helper — localhost `url`-scoped cookie, `deriveProjectRef`mirror, no custom token cookie)_`playwright.config.ts`: single `chromium`project,`baseURL`from env (default`http://localhost:5000`), `workers: 1`, `retries: process.env.CI ? 2 : 0`, a `webServer`running`pnpm --filter @puck/web dev`(or assume an already-running app + local Supabase, matching CandyStore's external-stack model — pick one and document it).`e2e/helpers/session.ts`— adapt`candystore/apps/auth/e2e/helpers/session.ts`, **simplified for Puck**: derive `sb-<ref>-auth-token`from`NEXT_PUBLIC_SUPABASE_URL`, base64-encode the session payload as `@supabase/ssr`does, set the cookie on`localhost`only (no shared root domain), including the`.0`chunk. No custom`auth_access_token` cookie.

- [x] **Step 2: Auth fixture (admin createUser + sign-in + inject)** _(`authenticatedPage` fixture; auto-created `user_profiles` via foundation triggers; deletes the user on teardown)_
      `e2e/fixtures/auth.fixture.ts` — adapt CandyStore's fixture: `supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, …)`; `createUser({ email_confirm: true })`; `signInWithPassword` to get tokens; `injectSession(context, …)`; cleanup deletes the user. (The foundation triggers auto-create the `user_profiles` row + consumer permissions on `createUser` — no manual profile seeding needed.)

- [x] **Step 3: Tests** _(auth-redirect + login a11y; seeded-session account edit that reloads to prove DB persistence + account a11y — 4/4 green via axe)_
      `auth-redirect.spec.ts` (no fixture — unauthenticated):

```ts
import { test, expect } from "@playwright/test";
test("unauthenticated /account redirects to login", async ({ page }) => {
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/login/);
  await expect(page.getByTestId("login")).toBeVisible();
});
```

`account.spec.ts` (uses `authenticatedPage` fixture):

```ts
import { test, expect } from "../fixtures/auth.fixture";
test("authenticated user edits display name", async ({
  page,
  authenticatedPage,
}) => {
  await page.goto("/en/account");
  await expect(page.getByTestId("account")).toBeVisible();
  await page.getByTestId("profile-display-name").fill("E2E Organizer");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-display-name")).toHaveValue(
    "E2E Organizer",
  );
});
```

Plus an axe a11y check on `/en/login` and `/en/account` (`@axe-core/playwright`; assert zero violations).

- [x] **Step 4: Run** _(local Supabase up, all 4 E2E green; commit pending user)_
      Bring up local Supabase + the app, then `pnpm --filter @puck/web test:e2e`. Expected: all green.

```bash
git add apps/web .env.example && git commit -m "test(web): slice-1 e2e — protected redirect + seeded-session account edit + a11y [GH-5]"
```

---

## Task 13: Docs, env surface, full DoD sweep + sign-out verification

**Files:**

- Modify: `.env.example` (the `NEXT_PUBLIC_SUPABASE_*` + OAuth provider placeholders), `README.md` (apps/web run/test instructions + the OAuth-credentials prerequisite), `CLAUDE.md` (note `apps/web` exists + `pnpm --filter @puck/web dev`)

- [x] **Step 1: Env + README** _(`.env.example`: NEXT_PUBLIC_SUPABASE_\*, OAuth placeholders, SERVICE*ROLE E2E note; README `apps/web` run/test section)*
      Add to `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and **commented** `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/SECRET`, `SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID/SECRET` (placeholders only), plus `SUPABASE_SERVICE_ROLE_KEY` (E2E-only, with a comment). README: how to run `apps/web` against local Supabase, run unit + E2E tests, and the prerequisite that **real Google/Discord OAuth credentials are needed only for manual login** (per spec §5).

- [x] **Step 2: Full DoD sweep** _(GREEN: format, lint, typecheck ×4 workspaces, 30 unit tests, `next build`, 4 E2E)_
      Run, from repo root, and fix anything red:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm --filter @puck/web test
pnpm --filter @puck/web build
```

Then E2E (with local Supabase + app up): `pnpm --filter @puck/web test:e2e`.
Expected: all green. Generated/config files follow the generated-code + lint policies.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(web): env surface + README run/test + apps/web getting-started [GH-5]"
```

---

## Self-Review

**1. Spec coverage** (`2026-06-30-puck-web-shell-auth-design.md`):

| Spec section                                                                          | Task(s)                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| §3 scope/DoD                                                                          | all; verified in 13                               |
| §4 architecture (apps/web structure, @puck/ui, direct-Supabase, design-system wiring) | 1, 2, 3, 8                                        |
| §5 auth (OAuth, @supabase/ssr, middleware, callback, sign-out, trigger integration)   | 3, 5, 6, 7, 11                                    |
| §6 account (email-from-session, column-scoped queries, layers)                        | 9, 10, 11                                         |
| §7 responsive shell + i18n (en/es)                                                    | 4, 8                                              |
| §8 testing (unit/vi.mock, E2E seeded session, a11y)                                   | every task; 12                                    |
| §9 GitHub-tasks flow                                                                  | branch `feat/GH-5_…`; PR `Closes #5` at execution |

**2. Placeholder scan:** No "TBD"/"implement later". The few "adapt from CandyStore `<path>`" pointers each name an EXACT real file + the explicit Puck deltas (column-scoping, app-local, no multi-app domain) — these are concrete adaptation instructions, not placeholders. Design-token authoring (Task 2) lists the exact token set + WCAG check.

**3. Type consistency:** `Profile` (Task 9) is used identically in Tasks 10–11; `ProfileFormValues`/`ProfileFormInput` (Task 9 schema) flow into the form (Task 11); `fetchProfile`/`updateProfile` signatures match their consumers; `useProfile`/`useUpdateProfile` names are stable; `PROFILE_QUERY_KEY`/`PROFILE_COLUMNS` are defined once and reused. `createBrowserSupabaseClient`/`createServerSupabaseClient` names are consistent across Tasks 3/5/6/7.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-30-puck-web-shell-auth.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
