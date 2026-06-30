# Telegram Notifications

> Reference for Puck's Telegram delivery channel — both the **consumer bot** (`apps/bot`) and the **CI/CD alert bot** used in GitHub Actions workflows.

---

## Puck Consumer Bot

The Telegram bot is sub-project #4 in the build sequence. It provides end-user discovery and subscription management.

### Capabilities

| Feature              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| Event discovery      | Browse upcoming umbrella events                           |
| Session browsing     | View a day's schedule for a subscribed event              |
| Subscribe to event   | Receive daily digest notifications for an event           |
| Subscribe to session | Receive per-occurrence reminders at configured lead times |
| Reminder offsets     | Configure T-30, T-15, T-10, T-5, or at-start reminders    |
| Account linking      | Link Telegram account to Puck user profile                |

### Bot Credentials (stored in `.secrets`)

| Variable             | Description                                     |
| -------------------- | ----------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather (stored in `.secrets`) |

> **Never commit a real bot token.** Use `<placeholder>` in docs and examples.

### Notification Types Delivered via Telegram

1. **Session reminder** — sent at configured lead times before each occurrence
   - Keyed by `dedupe_key = occurrence_id + subscriber_id + offset + "telegram"` — unique constraint prevents duplicate sends.
2. **Daily digest** — sent once per day per event subscription with that day's session list
   - Keyed by `dedupe_key = event_id + subscriber_id + date + "telegram"`.

### NotificationChannel Port

All Telegram delivery goes through `TelegramChannel` in `@puck/channels`, which implements the `NotificationChannel` port from `@puck/core`. The worker calls the port; it never imports the Telegram SDK directly.

```typescript
// packages/channels/src/telegram-channel.ts
export class TelegramChannel implements NotificationChannel {
  readonly name = 'telegram';
  async send(payload: NotificationPayload): Promise<void> { ... }
}
```

---

## CI/CD Alert Bot (GitHub Actions)

Puck uses a Telegram bot to route GitHub Actions alerts into a project supergroup.

### Variables (stored in `.secrets` and GitHub Secrets)

| Variable                      | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`          | Bot token (stored in `.secrets`)                  |
| `TELEGRAM_CHAT_ID`            | Supergroup/channel chat ID                        |
| `TELEGRAM_CRITICAL_THREAD_ID` | Thread ID for deployment failures / health alerts |
| `TELEGRAM_THREAD_ID`          | Thread ID for general CI/CD notifications         |

### Workflows to Thread Mapping

| Workflow file       | Event                   | Thread used                   |
| ------------------- | ----------------------- | ----------------------------- |
| `notify-deploy.yml` | Deployment success/fail | `TELEGRAM_CRITICAL_THREAD_ID` |
| General CI checks   | Scheduled               | `TELEGRAM_THREAD_ID`          |

---

## Adding a New Reminder Offset

1. Add the offset value to the `ReminderOffset` value object in `@puck/core`.
2. Update the subscription UI in `apps/web` to expose the new option.
3. Update the worker's scheduling logic to enqueue a job at the new offset.
4. The `dedupe_key` generation in `DedupeKey.forSessionReminder` automatically covers the new offset — no constraint changes needed.

## Adding a New Notification Channel

1. Implement `NotificationChannel` in `@puck/channels`.
2. Register it in `apps/worker/src/container.ts`.
3. The worker dispatches to all registered channels automatically — no core changes needed.

---

## Related

- `.secrets` — Local source of truth for all secrets
- `packages/channels/` — `TelegramChannel` and `EmailChannel` implementations
- `apps/bot/` — Telegram consumer bot entry point
- `.claude/docs/architecture/overview.md` — Notification pipeline and dedupe_key design
- [Git Safety](./git-safety.md) — Never commit real secret values
