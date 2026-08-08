# Architecture Overview

## Philosophy

Puck implements **Hexagonal (Ports & Adapters) Architecture** across a pnpm monorepo. The domain model lives in `@puck/core` and knows nothing about any external system; adapters (`@puck/db`, `@puck/queue`, `@puck/channels`, …) implement the ports and are wired up by application entry points.

### Why This Architecture?

| Problem                            | Solution                                     |
| ---------------------------------- | -------------------------------------------- |
| Tight coupling to Supabase         | Repository port in core; adapter in @puck/db |
| Hard to swap notification channels | `NotificationChannel` port; channel adapters |
| Hard to test domain logic          | Core has zero infrastructure imports         |
| Framework lock-in                  | Domain logic is pure TypeScript              |
| Queue vendor lock-in               | `Queue` port; pgmq adapter by default        |

### Sources & Inspiration

- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture - Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [pnpm Workspaces Best Practices](https://pnpm.io/workspaces)

---

## Core Concepts

### 1. The Dependency Rule

> "Source code dependencies must point only inward, toward higher-level policies."

```
┌──────────────────────────────────────────────────────────┐
│               APPLICATIONS (apps/*)                      │
│   apps/web · apps/api · apps/worker · apps/bot           │
│          (depend on @puck/core + adapters)               │
├──────────────────────────────────────────────────────────┤
│               ADAPTERS (packages/*)                      │
│   @puck/db · @puck/queue · @puck/channels                │
│          (implement ports from @puck/core)               │
├──────────────────────────────────────────────────────────┤
│               DOMAIN — @puck/core                        │
│   Entities, Ports (interfaces), Domain errors            │
│          (imports nothing external)                      │
└──────────────────────────────────────────────────────────┘
```

- **@puck/core** is the innermost ring — no SDK imports, no Supabase, no Telegram
- **Adapters** implement the ports defined in core
- **Apps** wire adapters to ports and handle routing/scheduling concerns

### 2. Domain Model

The domain centers on a three-level hierarchy:

```
Event (umbrella — multi-day festival/conference)
 └─ Session (a scheduled item with start time; may recur)
     └─ Occurrence (a concrete instance of a recurring session)
```

**Subscriptions** operate at two levels:

- **Event subscription** → daily digest (one notification per day listing that day's sessions)
- **Session subscription** → per-occurrence reminders at configurable lead times: T-30, T-15, T-10, T-5, and at start

**Permissions** use a **Libra-style permission system**: each event has one owner plus optional delegates. Authoring operations are guarded by Supabase RLS using this owner/delegate model.

### 3. Application Topology

```
apps/
├── web/          # Next.js admin — create/edit events, sessions, recurrence, delegates
├── api/          # Fastify REST API — consumed by web and bot
├── worker/       # Node.js worker — pgmq consumer, notification fan-out, delivery
└── bot/          # Telegram consumer bot — discovery, subscribe, set reminder offsets
packages/
├── core/         # @puck/core — domain entities + ports (no infrastructure)
├── db/           # @puck/db — Supabase Postgres adapter (implements repository ports)
├── queue/        # @puck/queue — pgmq adapter (implements Queue port)
└── channels/     # @puck/channels — Telegram + email adapters (NotificationChannel port)
```

### 4. Notification Pipeline (Outbox Pattern)

Schedule changes are written to the DB with a trigger that enqueues fan-out work in the same transaction. The worker picks up queue messages and fans out to each subscriber's configured channels.

```
Organizer mutates session
  → DB trigger writes to pgmq queue (same transaction)
    → Worker dequeues message
      → Looks up subscriptions
        → For each subscription × channel: upsert notification with dedupe_key
          → Deliver via Telegram / email adapter
```

**Idempotency is sacred.** Each notification has a deterministic `dedupe_key` (unique constraint) keyed on `(trigger, subscription, channel)` — e.g. `(occurrence_id, subscriber_id, "telegram")` — so duplicate sends are structurally impossible.

---

## Layer Details

### @puck/core — Domain Layer

The innermost package. Contains:

| Element       | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| Entities      | Event, Session, Occurrence, Subscription, User                                |
| Ports         | IEventRepository, ISessionRepository, INotificationQueue, NotificationChannel |
| Domain errors | Custom typed errors                                                           |
| Value objects | ReminderOffset, DedupeKey, etc.                                               |

**Rules:**

- No imports from adapter packages or SDKs
- Pure TypeScript; ESM only
- All business invariants enforced here

### Adapter Packages

| Package          | Port implemented         | SDK used                     |
| ---------------- | ------------------------ | ---------------------------- |
| `@puck/db`       | Repository ports         | Supabase JS                  |
| `@puck/queue`    | Queue port               | pgmq                         |
| `@puck/channels` | NotificationChannel port | Telegram Bot API, nodemailer |

### Application Layer (apps/\*)

Each app is a thin wiring layer:

- **apps/api** — Fastify routes → call core services → use adapter implementations
- **apps/worker** — pg_cron / pgmq consumer → dispatch fan-out → call channel adapters
- **apps/web** — Next.js pages → call API or use Supabase client directly for reads
- **apps/bot** — Telegram webhook handler → call API for subscribe/unsubscribe/list

---

## Anti-Patterns to Avoid

### 1. Business Logic in Adapters

```typescript
// BAD — @puck/db deciding subscription eligibility
export class SupabaseSubscriptionRepo {
  async subscribe(userId: string, sessionId: string) {
    if (/* some rule */) return; // NO — this belongs in core
  }
}

// GOOD — core enforces, adapter persists
export class SubscriptionService {
  async subscribe(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    session.assertSubscribable(); // domain rule in core
    await this.subscriptionRepo.create({ userId, sessionId });
  }
}
```

### 2. Direct SDK Calls in Core

```typescript
// BAD — @puck/core importing Supabase
import { createClient } from "@supabase/supabase-js"; // NO

// GOOD — @puck/core defines the port; adapter holds the SDK
export interface IEventRepository {
  findById(id: string): Promise<Event | null>;
}
```

### 3. Fan-Out in Request Handlers

```typescript
// BAD — synchronous Telegram delivery in the API route
app.post("/sessions", async (req, reply) => {
  await db.createSession(data);
  await telegramBot.notifySubscribers(data); // NO — do this in the worker
});

// GOOD — enqueue in the same transaction; worker delivers async
app.post("/sessions", async (req, reply) => {
  await db.createSessionWithOutboxEntry(data); // trigger enqueues the job
});
```

### 4. Weakening Dedupe Guarantees

```typescript
// BAD — ignoring the dedupe_key constraint
await db.notifications.insert({ ...payload }); // may throw on duplicate

// GOOD — use upsert with ON CONFLICT DO NOTHING
await db.notifications.upsert(
  { ...payload },
  { onConflict: "dedupe_key", ignoreDuplicates: true },
);
```
