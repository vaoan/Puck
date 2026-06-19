import type { ChannelKey } from "../domain/channels.js";

/**
 * Deterministic notification dedupe key.
 *
 * The same (event change, subscription, channel) triple always produces the
 * same key. Combined with a UNIQUE constraint in the database and using the
 * key as the queue message identity, this is Puck's guarantee against
 * duplicate sends: re-processing a change can never deliver twice.
 */
export function notificationDedupeKey(input: {
  eventChangeId: string;
  subscriptionId: string;
  channel: ChannelKey;
}): string {
  return `${input.eventChangeId}:${input.subscriptionId}:${input.channel}`;
}
