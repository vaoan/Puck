import type { ChannelKey } from "../domain/channels.js";
import type { ChannelRegistry } from "../ports/notification-channel.js";
import type {
  EventChangeRepository,
  EventRepository,
  NotificationRepository,
  SubscriptionRepository,
} from "../ports/repositories.js";

import { renderEventChange } from "./render.js";

export interface DeliverDeps {
  notifications: NotificationRepository;
  eventChanges: EventChangeRepository;
  events: EventRepository;
  subscriptions: SubscriptionRepository;
  registry: ChannelRegistry;
  /** Injectable clock keeps the service deterministic in tests. */
  now: () => string;
  maxAttempts: number;
}

/**
 * What the worker should do with the queue message after this attempt.
 *  - `ack`     handled (sent or deliberately skipped) → delete the message
 *  - `retry`   transient failure → leave it for redelivery with backoff
 *  - `archive` give up (permanent error or attempts exhausted) → dead-letter
 */
export type DeliveryOutcome = "ack" | "retry" | "archive";

/**
 * Deliver a single notification. Safe to call more than once for the same id:
 * anything not in `pending` is treated as already-handled and acked, so a
 * redelivered queue message never causes a duplicate send.
 */
export async function deliverNotification(
  notificationId: string,
  deps: DeliverDeps,
): Promise<DeliveryOutcome> {
  const notification = await deps.notifications.getById(notificationId);
  if (!notification || notification.status !== "pending") {
    return "ack";
  }

  const change = await deps.eventChanges.getById(notification.eventChangeId);
  const subscription = await deps.subscriptions.getById(
    notification.subscriptionId,
  );
  if (!change || !subscription) {
    await deps.notifications.markSkipped(notification.id);
    return "ack";
  }

  const event = await deps.events.getById(change.eventId);
  if (!event) {
    await deps.notifications.markSkipped(notification.id);
    return "ack";
  }

  const message = renderEventChange(event, change);
  const channel = deps.registry.require(subscription.channel as ChannelKey);
  const attempt = notification.attempts + 1;

  const result = await channel.send(message, {
    channel: subscription.channel,
    address: subscription.address,
  });

  await deps.notifications.recordAttempt({
    notificationId: notification.id,
    attempt,
    ok: result.ok,
    providerRef: result.providerRef,
    error: result.error,
  });

  if (result.ok) {
    await deps.notifications.markSent(notification.id, deps.now());
    return "ack";
  }

  // Permanent failure or attempts exhausted → stop and dead-letter.
  if (result.permanent || attempt >= deps.maxAttempts) {
    await deps.notifications.markFailed(notification.id, attempt);
    return "archive";
  }

  // Transient failure → keep `pending`, record progress, let queue redeliver.
  await deps.notifications.bumpAttempts(notification.id, attempt);
  return "retry";
}
