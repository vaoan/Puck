import type { ChannelKey } from "./channels.js";

export const NOTIFICATION_STATUSES = [
  "pending",
  "sent",
  "failed",
  "skipped",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/**
 * A single intended delivery: "notify this subscription about this change".
 *
 * The `dedupeKey` carries a UNIQUE constraint in the database. Creating the
 * same notification twice is a no-op, which is how Puck guarantees it never
 * sends a duplicate even if a change is fanned out more than once.
 */
export interface Notification {
  id: string;
  eventChangeId: string;
  subscriptionId: string;
  channel: ChannelKey;
  dedupeKey: string;
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

/** A channel-agnostic, fully-rendered message ready for an adapter to send. */
export interface RenderedMessage {
  /** Short title / subject line. */
  title: string;
  /** Plain-text body. Adapters may upgrade to richer formats. */
  body: string;
}

/** The concrete target an adapter delivers to. */
export interface DeliveryTarget {
  channel: ChannelKey;
  address: string;
}

/** Outcome of a single delivery attempt, recorded for observability. */
export interface DeliveryResult {
  ok: boolean;
  /** Provider-side id, when available (message id, etc.). */
  providerRef?: string;
  error?: string;
  /** When true, retrying will not help (e.g. blocked bot, invalid address). */
  permanent?: boolean;
}
