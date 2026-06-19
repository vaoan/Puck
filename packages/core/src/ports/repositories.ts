import type { EventChange, PuckEvent } from "../domain/events.js";
import type { ChannelSubscription, Follow } from "../domain/follows.js";
import type { Notification } from "../domain/notifications.js";

/**
 * Persistence ports. Implemented in `@puck/db` against Supabase. The domain
 * services depend on these interfaces, not on the Supabase client.
 */

export interface EventRepository {
  getById(id: string): Promise<PuckEvent | null>;
}

export interface FollowRepository {
  listFollowersForEvent(eventId: string): Promise<Follow[]>;
}

export interface SubscriptionRepository {
  getById(id: string): Promise<ChannelSubscription | null>;
  listVerifiedForUser(userId: string): Promise<ChannelSubscription[]>;
}

export interface EventChangeRepository {
  getById(id: string): Promise<EventChange | null>;
}

export interface NotificationRepository {
  getById(id: string): Promise<Notification | null>;

  /**
   * Insert a notification if its `dedupeKey` is new. Returns the row whether it
   * was created or already existed (idempotent upsert on the unique key).
   */
  createIfAbsent(input: NewNotification): Promise<Notification>;

  markSent(id: string, sentAt: string): Promise<void>;
  /** Terminal failure — notification will not be retried. */
  markFailed(id: string, attempts: number): Promise<void>;
  markSkipped(id: string): Promise<void>;
  /** Record a transient failure: bump the attempt count but keep `pending`
   * so the queue can redeliver and reprocessing resumes. */
  bumpAttempts(id: string, attempts: number): Promise<void>;

  /** Append a per-attempt delivery record for observability. */
  recordAttempt(input: DeliveryAttempt): Promise<void>;
}

export interface NewNotification {
  eventChangeId: string;
  subscriptionId: string;
  channel: string;
  dedupeKey: string;
}

export interface DeliveryAttempt {
  notificationId: string;
  attempt: number;
  ok: boolean;
  providerRef?: string;
  error?: string;
}
