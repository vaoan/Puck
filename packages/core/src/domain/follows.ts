import type { ChannelKey } from "./channels.js";
import type { EventChangeType } from "./events.js";

/** A user's intent to be notified about an event. */
export interface Follow {
  id: string;
  userId: string;
  eventId: string;
  /** Mute specific change types without unfollowing entirely. */
  mutedTypes: EventChangeType[];
  createdAt: string;
}

/**
 * A verified destination on a given channel for a user — e.g. a Telegram chat
 * id or an email address. A user may have many (one per channel, or several).
 */
export interface ChannelSubscription {
  id: string;
  userId: string;
  channel: ChannelKey;
  /** Channel-specific address: chat id, email, phone, etc. */
  address: string;
  /** Only verified destinations receive notifications. */
  verified: boolean;
  createdAt: string;
}
