import type {
  ChannelKey,
  ChannelRegistry,
  NotificationChannel,
} from "@puck/core";

/**
 * Simple in-memory registry. The worker resolves channels through this and
 * never imports a concrete adapter, so adding a channel is purely additive.
 */
export function createChannelRegistry(
  channels: NotificationChannel[],
): ChannelRegistry {
  const map = new Map<ChannelKey, NotificationChannel>();
  for (const channel of channels) {
    map.set(channel.key, channel);
  }

  return {
    get: (key) => map.get(key),
    require(key) {
      const channel = map.get(key);
      if (!channel) {
        throw new Error(`No notification channel registered for "${key}"`);
      }
      return channel;
    },
    keys: () => [...map.keys()],
  };
}
