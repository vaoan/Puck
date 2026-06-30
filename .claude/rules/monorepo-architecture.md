# Monorepo Architecture

> This document defines the overall monorepo structure and how Hexagonal Architecture applies at both the repository level and within individual applications.

---

## Overview

Puck is a **pnpm workspace monorepo** containing a Next.js web app, a Fastify API, a Node worker, and a Telegram bot — all sharing domain packages. The architecture follows Hexagonal (Ports & Adapters) principles:

1. **Repository Level** — How packages and apps relate to each other
2. **Application Level** — How each app wires adapters to ports

### Expert Sources

This architecture is informed by:

- [Uncle Bob's Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - The Dependency Rule
- [Hexagonal Architecture - Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [pnpm Workspaces Best Practices](https://pnpm.io/workspaces) - Workspace management

---

## Repository Structure

```
puck/
├── apps/                          # Applications (consume packages)
│   ├── web/                       # Next.js authoring web app — events, sessions, delegates
│   │   └── src/
│   │       ├── app/               # Next.js App Router (routing only)
│   │       ├── features/          # Feature modules
│   │       └── shared/            # App-specific shared code
│   ├── api/                       # Fastify REST API — consumed by web + bot
│   │   └── src/
│   │       ├── routes/
│   │       ├── plugins/           # Supabase JWT auth, etc.
│   │       └── container.ts       # Wire adapters → ports
│   ├── worker/                    # Node.js fan-out worker (pgmq consumer)
│   │   └── src/
│   │       ├── handlers/          # fan-out-handler, daily-digest-handler
│   │       └── container.ts
│   └── bot/                       # Telegram consumer bot
│       └── src/
│           ├── handlers/          # start, discover, subscribe, reminders
│           └── container.ts
├── packages/                      # Shared packages (consumed by apps)
│   ├── core/                      # @puck/core — domain entities + ports
│   │   └── src/
│   │       ├── entities/          # Event, Session, Occurrence, Subscription
│   │       ├── ports/             # IEventRepository, NotificationChannel, etc.
│   │       ├── errors/            # Custom domain errors
│   │       └── value-objects/     # ReminderOffset, DedupeKey, etc.
│   ├── db/                        # @puck/db — Supabase repository adapters
│   │   └── src/
│   │       └── repositories/
│   ├── queue/                     # @puck/queue — pgmq queue adapter
│   │   └── src/
│   ├── channels/                  # @puck/channels — Telegram + email adapters
│   │   └── src/
│   └── ui/                        # @puck/ui — shared UI components (shadcn/ui)
│       └── src/
│           ├── components/        # Pure presentational components
│           └── utils/             # UI utilities (cn, etc.)
├── supabase/
│   └── migrations/                # SQL migration files (never edit applied ones)
├── eslint.config.mjs              # Monorepo-wide ESLint (single config)
├── package.json                   # Root scripts and shared devDependencies
├── pnpm-workspace.yaml            # Workspace definition
└── tsconfig.base.json             # Shared TypeScript config
```

---

## The Dependency Rule (Repository Level)

At the repository level, dependencies flow in ONE direction:

```
┌─────────────────────────────────────────────────────────────────┐
│                         APPLICATIONS                             │
│           apps/web · apps/api · apps/worker · apps/bot           │
│      Wire adapters to ports; handle routing/scheduling           │
├─────────────────────────────────────────────────────────────────┤
│                      ADAPTER PACKAGES                            │
│       @puck/db · @puck/queue · @puck/channels · @puck/ui         │
│          Implement ports; hold SDK/framework imports             │
├─────────────────────────────────────────────────────────────────┤
│                      DOMAIN PACKAGE                              │
│                         @puck/core                               │
│      Entities, ports, value objects — zero external deps         │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                    Dependencies flow UP
                    (core knows nothing about adapters or apps)
```

### Rules

| Rule                              | Description                                                       |
| --------------------------------- | ----------------------------------------------------------------- |
| **Apps depend on packages**       | Apps import from `@puck/core` and adapter packages                |
| **Packages NEVER depend on apps** | Packages have no knowledge of consuming apps                      |
| **@puck/core imports no SDKs**    | No Supabase, no Telegram, no HTTP clients in core                 |
| **Adapters implement ports**      | Each adapter package implements interfaces defined in core        |
| **Apps own their wiring**         | Each app's `container.ts` injects the right adapter for each port |

---

## Package Types

### UI Package (`packages/ui`)

**Purpose:** Pure, presentational UI components based on shadcn/ui and Radix primitives.

**Contains:**

- Radix-based UI components (Button, Card, Sheet, etc.)
- Utility functions (cn for className merging)
- Component variants (using class-variance-authority)

**Does NOT contain:**

- Translations or i18n hooks
- Business logic
- Data fetching
- App-specific configuration

**Export Pattern:**

```typescript
// packages/ui/src/index.ts
export { cn } from "./utils/cn";
export * from "./components/button";
export * from "./components/card";
// ... pure UI components only
```

**Consumption:**

```typescript
// In any app
import { Button, Card, cn } from "ui";
```

### Core Package (`packages/core` / `@puck/core`)

**Purpose:** Hexagonal domain — entities, ports (interfaces), value objects, and domain errors. Zero external dependencies.

**Contains:**

- Domain entities (`Event`, `Session`, `Occurrence`, `Subscription`)
- Port interfaces (`IEventRepository`, `NotificationChannel`, `Queue`, etc.)
- Value objects (`ReminderOffset`, `DedupeKey`, etc.)
- Custom domain errors

**Does NOT contain:**

- Any SDK imports (no Supabase, no Telegram, no HTTP clients)
- Infrastructure concerns
- Framework code

**Export Pattern:**

```typescript
// packages/core/src/index.ts
export type { IEventRepository } from "./ports/i-event-repository";
export type { NotificationChannel } from "./ports/notification-channel";
export { ReminderOffset } from "./value-objects/reminder-offset";
// ... entities, ports, value objects only
```

**Consumption:**

```typescript
// In any adapter or app
import type { IEventRepository } from "@puck/core";
import { ReminderOffset } from "@puck/core";
```

### Adapter Packages (`packages/db`, `packages/queue`, `packages/channels`)

**Purpose:** Implement the ports defined in `@puck/core`. Each adapter package wraps a single external SDK.

| Package          | Implements port          | SDK / infra             |
| ---------------- | ------------------------ | ----------------------- |
| `@puck/db`       | `IEventRepository`, etc. | Supabase JS client      |
| `@puck/queue`    | `Queue`                  | pgmq (via Postgres)     |
| `@puck/channels` | `NotificationChannel`    | Telegram Bot API, email |

**Rules:**

- Adapters import from `@puck/core` for port interfaces; never the reverse.
- Apps depend on adapter packages to wire concrete implementations into their `container.ts`.
- Adding a new channel (e.g. Discord, SMS) means implementing `NotificationChannel` in `@puck/channels` — no changes to core or worker.

### Import Rules in Packages

**Packages MUST use absolute imports for cross-directory references.** Same-directory relative imports (e.g., `./Component`) are allowed.

| Context                          | Rule                  | Example                        |
| -------------------------------- | --------------------- | ------------------------------ |
| Same directory                   | MAY use relative      | `./ThemeProvider`              |
| Cross-directory in packages/core | **MUST** use absolute | `@puck/core/ports/queue`       |
| Cross-directory in packages/ui   | **MUST** use absolute | `@ui/utils/cn`                 |
| Generated code                   | Any imports allowed   | (generated files are excluded) |

**Path Aliases:**

```json
// packages/core/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@puck/core/*": ["./src/*"]
    }
  }
}

// packages/ui/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@ui/*": ["./src/*"]
    }
  }
}
```

**Examples:**

```typescript
// ✅ CORRECT: Absolute imports for cross-directory
import type { IEventRepository } from "@puck/core/ports/i-event-repository";
import { cn } from "@ui/utils/cn";

// ✅ CORRECT: Same-directory relative import
export { EventEntity } from "./event-entity";

// ❌ INCORRECT: Relative import crossing directories
import type { IEventRepository } from "../ports/i-event-repository";
import { cn } from "../utils/cn";
```

This rule is enforced by ESLint via `no-restricted-imports`.

---

## i18n Strategy: Props Injection Pattern

Shared packages MUST NOT have i18n dependencies. Instead, apps inject translated strings as props.

### Why?

Following the [Dependency Inversion Principle](https://medium.com/@ahmed.ally2/clean-architecture-with-dependency-rule-6a41f899e3c2):

- Packages should not depend on app-specific concerns (i18n is app-specific)
- Each app can have different locales, different translation backends
- Components remain pure and testable without i18n setup

### Implementation

**In shared UI package:**

```typescript
// packages/ui/src/components/sheet.tsx
interface SheetContentProps {
  // ... other props
  closeLabel?: string;  // App injects translated label
}

function SheetContent({ closeLabel = "Close", ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Close aria-label={closeLabel}>
      <X className="size-4" />
    </SheetPrimitive.Close>
  );
}
```

**In consuming app:**

```typescript
// apps/web/src/features/some-feature/presentation/components/MySheet.tsx
"use client";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent } from "ui";

export function MySheet() {
  const t = useTranslations("common");

  return (
    <Sheet>
      <SheetContent closeLabel={t("close")}>
        {/* content */}
      </SheetContent>
    </Sheet>
  );
}
```

### Each App Owns Its Translations

```
apps/web/src/shared/infrastructure/i18n/
├── messages/
│   ├── en.json    # Web app English translations
│   └── es.json    # Web app Spanish translations
├── routing.ts     # Web app locale routing
└── request.ts     # Web app i18n config
```

---

## Standard App: Web

The `apps/web` application is the **reference standard**. All other apps MUST comply with its:

- ESLint configuration (enforced at monorepo root)
- Clean Architecture patterns
- Testing standards
- i18n setup patterns
- Component patterns

### Compliance Enforcement

```javascript
// eslint.config.mjs (root level)
// Single config applies to ALL apps and packages
files: [`apps/*/src/**/*.{ts,tsx}`, `packages/*/src/**/*.{ts,tsx}`],
```

This means:

- Same SOLID, DRY, KISS rules for all apps
- Same i18n strictness (no hardcoded strings)
- Same architectural boundaries
- Same import rules

---

---

## Application-Level Architecture

Within each app, Clean Architecture applies as documented in [Architecture Rules](./architecture.md):

```
apps/[app]/src/
├── app/                    # Next.js routing (thin wrappers only)
├── features/               # Feature modules
│   └── [feature]/
│       ├── domain/         # Types, interfaces, business rules
│       ├── application/    # Use cases, services, hooks
│       ├── infrastructure/ # API calls, external integrations
│       └── presentation/   # Components, pages
├── shared/                 # App-specific shared code
│   ├── domain/             # Shared types
│   ├── application/        # Shared hooks, utils
│   ├── infrastructure/     # i18n, providers, config
│   └── presentation/       # Shared UI components
└── mocks/                  # MSW and test mocks
```

---

## Workspace Configuration

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Package References

Apps reference packages using `workspace:*`:

```json
// apps/web/package.json
{
  "dependencies": {
    "@puck/core": "workspace:*",
    "@puck/db": "workspace:*",
    "@puck/ui": "workspace:*"
  }
}
```

### TypeScript Path Aliases

Each app has its own path aliases:

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@puck/core": ["../../packages/core/src"],
      "@puck/core/*": ["../../packages/core/src/*"],
      "@puck/ui": ["../../packages/ui/src"],
      "@puck/ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

### Next.js Transpilation

Apps must transpile workspace packages:

```typescript
// apps/web/next.config.ts
const nextConfig = {
  transpilePackages: ["@puck/core", "@puck/ui"],
};
```

---

## Source-to-Source Compilation

Packages are consumed as source code, not pre-built bundles:

```json
// packages/ui/package.json
{
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

### Benefits

1. **Tree-shaking** - Apps' bundlers can eliminate unused code
2. **No build step** - Packages don't need separate build process
3. **Hot reload** - Changes in packages reflect immediately in apps
4. **Simpler setup** - No version management between packages

### Trade-offs

- Packages must use ES Modules syntax
- TypeScript config must be compatible across all packages
- Bundler handles all transpilation

---

## Adding New Apps

When adding a new application:

1. **Create app folder**: `apps/[app-name]/`
2. **Copy structure from web**: Use `apps/web` as template
3. **Set up i18n**: Create own `shared/infrastructure/i18n/` with locale files
4. **Configure TypeScript**: Extend `tsconfig.base.json`, add path aliases
5. **Add transpilePackages**: Include `@puck/core`, `@puck/ui`, and any other workspace packages consumed
6. **Verify lint compliance**: Run `pnpm lint` - no exceptions allowed

---

## Adding to Shared Packages

Before adding code to a shared package, verify:

| Question                      | If No                           |
| ----------------------------- | ------------------------------- |
| Is it used by 2+ apps?        | Keep in the consuming app       |
| Is it framework-agnostic?     | Keep in the consuming app       |
| Does it belong in the domain? | Add to `@puck/core`             |
| Is it infra/SDK-specific?     | Add to the relevant adapter     |
| Is it pure (no side effects)? | Good candidate for `@puck/core` |

### Adding a UI Component

```bash
# 1. Create in packages/ui/src/components/
# 2. Export from packages/ui/src/index.ts
# 3. Ensure no i18n - use props for labels
# 4. Run lint and typecheck
pnpm lint && pnpm typecheck
```

### Adding a Domain Port or Value Object

```bash
# 1. Create in packages/core/src/ports/ or packages/core/src/value-objects/
# 2. Export from packages/core/src/index.ts
# 3. Ensure zero external imports — core is dependency-free
# 4. Run lint and typecheck
pnpm lint && pnpm typecheck
```

---

## Commands

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Start all apps (Turbo)           |
| `pnpm build`     | Build all workspaces             |
| `pnpm lint`      | Lint all apps and packages       |
| `pnpm typecheck` | Type-check all workspaces        |
| `pnpm test`      | Run all tests (Vitest via Turbo) |

---

## Related

- [Architecture Rules](./architecture.md) - Application-level Clean Architecture
- [Component Patterns](./component-patterns.md) - Component structure
- [Naming Conventions](./naming-conventions.md) - File and code naming
- [i18n Skill](../skills/i18n/SKILL.md) - Internationalization setup
