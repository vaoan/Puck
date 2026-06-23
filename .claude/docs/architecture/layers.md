# Layer Documentation

Detailed documentation for each architectural layer in Puck's hexagonal architecture.

---

## @puck/core — Domain Layer

### Purpose

Contains the core business logic and rules independent of any framework, UI, or external service. This package has **zero infrastructure imports** — no Supabase, no Telegram SDK, no HTTP clients.

### Location

```
packages/core/src/
├── entities/         # Domain entities with behaviour
│   ├── event.ts      # Umbrella event (festival/conference)
│   ├── session.ts    # Scheduled item (may recur)
│   ├── occurrence.ts # Concrete recurrence instance
│   ├── subscription.ts  # Event or session subscription
│   └── user.ts
├── ports/            # Interface contracts (implemented by adapters)
│   ├── event-repository.ts
│   ├── session-repository.ts
│   ├── occurrence-repository.ts
│   ├── subscription-repository.ts
│   ├── notification-queue.ts      # Queue port
│   └── notification-channel.ts   # Channel port
├── errors/           # Custom domain errors
├── value-objects/    # ReminderOffset, DedupeKey, etc.
└── index.ts          # Public exports
```

### Entities

Domain objects with business behaviour:

```typescript
// packages/core/src/entities/session.ts
import { ReminderOffset, DedupeKey } from "../value-objects/index.js";
import { SessionNotSubscribableError } from "../errors/index.js";

export class Session {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly title: string,
    public readonly startsAt: Date,
    public readonly recurrenceRule: string | null,
  ) {}

  assertSubscribable(): void {
    if (this.startsAt < new Date()) {
      throw new SessionNotSubscribableError(this.id);
    }
  }

  dedupeKeyFor(
    subscriberId: string,
    offset: ReminderOffset,
    channel: string,
  ): DedupeKey {
    return DedupeKey.forSessionReminder(this.id, subscriberId, offset, channel);
  }
}
```

### Ports (Repository Contracts)

Define what operations are available without specifying how:

```typescript
// packages/core/src/ports/event-repository.ts
import type { Event } from "../entities/event.js";

export interface IEventRepository {
  findById(id: string): Promise<Event | null>;
  findAll(filters?: EventFilters): Promise<Event[]>;
  create(data: CreateEventDTO): Promise<Event>;
  update(id: string, data: Partial<Event>): Promise<Event>;
  delete(id: string): Promise<void>;
}
```

```typescript
// packages/core/src/ports/notification-channel.ts
import type { NotificationPayload } from "../value-objects/index.js";

export interface NotificationChannel {
  readonly name: string;
  send(payload: NotificationPayload): Promise<void>;
}
```

```typescript
// packages/core/src/ports/notification-queue.ts
import type { FanOutJob } from "../value-objects/index.js";

export interface INotificationQueue {
  enqueue(job: FanOutJob): Promise<void>;
  dequeue(batchSize: number): Promise<FanOutJob[]>;
  ack(jobId: string): Promise<void>;
  nack(jobId: string, reason: string): Promise<void>;
}
```

---

## @puck/db — Database Adapter Layer

### Purpose

Implements the repository ports from `@puck/core` using the Supabase JS SDK. This is the only place where Supabase-specific code lives.

### Location

```
packages/db/src/
├── repositories/
│   ├── supabase-event-repository.ts
│   ├── supabase-session-repository.ts
│   ├── supabase-occurrence-repository.ts
│   └── supabase-subscription-repository.ts
├── client.ts         # Supabase client initialisation
└── index.ts
```

### Repository Implementation Example

```typescript
// packages/db/src/repositories/supabase-event-repository.ts
import { createClient } from "@supabase/supabase-js";
import type { IEventRepository } from "@puck/core";
import type { Event } from "@puck/core";

export class SupabaseEventRepository implements IEventRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  async findById(id: string): Promise<Event | null> {
    const { data, error } = await this.db
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return EventMapper.toDomain(data);
  }
  // ...
}
```

---

## @puck/queue — Queue Adapter Layer

### Purpose

Implements the `INotificationQueue` port using pgmq (Postgres message queue running inside Supabase). Zero-infra — no Redis, no SQS.

### Location

```
packages/queue/src/
├── pgmq-queue.ts     # INotificationQueue implementation
└── index.ts
```

---

## @puck/channels — Notification Channel Adapters

### Purpose

Implements the `NotificationChannel` port for each delivery channel. Adding a new channel (Discord, SMS, push) means adding a new adapter here — **never** editing core or the worker's dispatch logic.

### Location

```
packages/channels/src/
├── telegram-channel.ts   # Telegram Bot API adapter
├── email-channel.ts      # nodemailer / email adapter
└── index.ts
```

### Channel Implementation Example

```typescript
// packages/channels/src/telegram-channel.ts
import TelegramBot from "node-telegram-bot-api";
import type { NotificationChannel, NotificationPayload } from "@puck/core";

export class TelegramChannel implements NotificationChannel {
  readonly name = "telegram";

  constructor(private readonly bot: TelegramBot) {}

  async send(payload: NotificationPayload): Promise<void> {
    await this.bot.sendMessage(payload.recipientAddress, payload.body, {
      parse_mode: "Markdown",
    });
  }
}
```

---

## apps/api — Fastify API Layer

### Purpose

Thin HTTP layer: validates incoming requests (zod), calls core domain services, returns responses. No business logic lives here.

### Location

```
apps/api/src/
├── routes/
│   ├── events.ts
│   ├── sessions.ts
│   └── subscriptions.ts
├── plugins/
│   └── auth.ts       # Supabase JWT verification
├── container.ts      # Wire adapters → ports
└── server.ts         # Fastify entry point
```

---

## apps/worker — Fan-Out Worker Layer

### Purpose

Dequeues `FanOutJob` messages from pgmq, resolves subscriptions, and delivers notifications through the registered channel adapters. Uses pg_cron or a polling loop for scheduling.

### Location

```
apps/worker/src/
├── handlers/
│   ├── fan-out-handler.ts      # Main dispatch logic
│   └── daily-digest-handler.ts
├── container.ts      # Wire adapters → ports
└── worker.ts         # Entry point, polling loop
```

---

## apps/web — Next.js Admin Layer

### Purpose

Organizer-facing web app for creating and managing events, sessions, recurrence rules, document uploads, and delegate management. Consumes `apps/api` for mutations; may use Supabase JS client directly for reads.

### Location

```
apps/web/src/
├── app/              # Next.js App Router (routing only)
├── features/
│   ├── events/       # Create/edit umbrella events
│   ├── sessions/     # Schedule sessions, recurrence
│   └── delegates/    # Owner/delegate management
└── shared/
```

---

## apps/bot — Telegram Bot Layer

### Purpose

Consumer-facing Telegram bot: discover events, browse daily schedules, subscribe to events or individual sessions, configure reminder offsets, link Telegram account to user profile.

### Location

```
apps/bot/src/
├── handlers/
│   ├── start.ts
│   ├── discover.ts
│   ├── subscribe.ts
│   └── reminders.ts
├── container.ts
└── bot.ts            # Webhook entry point
```

---

## Shared Concerns

### What Belongs in @puck/core

| Yes                          | No                          |
| ---------------------------- | --------------------------- |
| Entity definitions           | Supabase client calls       |
| Business rule enforcement    | Telegram API calls          |
| Port (interface) definitions | HTTP request/response types |
| DedupeKey computation        | pg_cron scheduling          |
| ReminderOffset value object  | Environment variable access |

### Cross-Package Communication

Packages communicate **only through ports defined in @puck/core**. Adapters never import from each other.

```
apps/* → import { IEventRepository } from '@puck/core'
        → inject SupabaseEventRepository from '@puck/db'

packages/db → implements IEventRepository from '@puck/core'
            → never imports from @puck/queue or @puck/channels
```
