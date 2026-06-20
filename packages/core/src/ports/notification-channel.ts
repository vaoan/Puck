import type { ChannelKey } from "../domain/channels.js";
import type {
  DeliveryResult,
  DeliveryTarget,
  RenderedMessage,
} from "../domain/notifications.js";

/**
 * The contract every delivery channel implements. This is the seam that makes
 * providers swappable: the worker depends only on this interface, never on
 * grammY, Resend, or any concrete SDK.
 *
 * To add Discord/SMS/WhatsApp: implement this interface in `@puck/channels`
 * and register it. Nothing in core or the worker needs to change.
 */
export interface NotificationChannel {
  readonly key: ChannelKey;

  /** Deliver a rendered message to a concrete target. Must not throw for
   * expected failures — return `{ ok: false }` so retry policy can apply. */
  send(
    message: RenderedMessage,
    target: DeliveryTarget,
  ): Promise<DeliveryResult>;

  /** Optional readiness probe (e.g. token present). Defaults to ready. */
  healthCheck?(): Promise<boolean>;
}

/**
 * Resolves a {@link ChannelKey} to its implementation. The worker asks the
 * registry for a channel by key and stays oblivious to how many exist.
 */
export interface ChannelRegistry {
  get(key: ChannelKey): NotificationChannel | undefined;
  require(key: ChannelKey): NotificationChannel;
  keys(): ChannelKey[];
}
