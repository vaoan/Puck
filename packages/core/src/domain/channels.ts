/**
 * The set of delivery channels Puck knows about.
 *
 * Adding a future channel (discord, sms, whatsapp, push) means adding a member
 * here and shipping an adapter in `@puck/channels` — no core logic changes.
 * The values are persisted to the database, so treat them as a stable contract.
 */
export const CHANNEL_KEYS = [
  "telegram",
  "email",
  // Reserved for future adapters — uncomment when an adapter is implemented.
  // "discord",
  // "sms",
  // "whatsapp",
  // "push",
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export function isChannelKey(value: string): value is ChannelKey {
  return (CHANNEL_KEYS as readonly string[]).includes(value);
}
