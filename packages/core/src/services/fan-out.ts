import type { NotificationJob, Queue } from "../ports/queue.js";
import type {
  EventChangeRepository,
  FollowRepository,
  NotificationRepository,
  SubscriptionRepository,
} from "../ports/repositories.js";

import { notificationDedupeKey } from "./dedupe.js";

export interface FanOutDeps {
  eventChanges: EventChangeRepository;
  follows: FollowRepository;
  subscriptions: SubscriptionRepository;
  notifications: NotificationRepository;
  queue: Queue<NotificationJob>;
}

export interface FanOutResult {
  created: number;
  enqueued: number;
  skipped: number;
}

/**
 * Expand one event change into per-follower, per-channel notifications and
 * enqueue them.
 *
 * Idempotency is layered:
 *  1. `createIfAbsent` upserts on the unique dedupe key — duplicates collapse.
 *  2. only freshly-created notifications are enqueued, so replaying a change
 *     never re-sends an already-handled one.
 */
export async function fanOutEventChange(
  eventChangeId: string,
  deps: FanOutDeps,
): Promise<FanOutResult> {
  const change = await deps.eventChanges.getById(eventChangeId);
  if (!change) {
    return { created: 0, enqueued: 0, skipped: 0 };
  }

  const followers = await deps.follows.listFollowersForEvent(change.eventId);
  const result: FanOutResult = { created: 0, enqueued: 0, skipped: 0 };

  for (const follow of followers) {
    if (follow.mutedTypes.includes(change.type)) {
      result.skipped += 1;
      continue;
    }

    const subs = await deps.subscriptions.listVerifiedForUser(follow.userId);
    for (const sub of subs) {
      const dedupeKey = notificationDedupeKey({
        eventChangeId: change.id,
        subscriptionId: sub.id,
        channel: sub.channel,
      });

      const { notification, created } = await deps.notifications.createIfAbsent(
        {
          eventChangeId: change.id,
          subscriptionId: sub.id,
          channel: sub.channel,
          dedupeKey,
        },
      );

      // Only enqueue freshly-created notifications. A replayed change finds the
      // existing row (created=false) and is skipped, so it never re-sends.
      if (created) {
        result.created += 1;
        await deps.queue.send({ notificationId: notification.id });
        result.enqueued += 1;
      } else {
        result.skipped += 1;
      }
    }
  }

  return result;
}
