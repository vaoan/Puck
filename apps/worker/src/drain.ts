import type { DeliveryOutcome, Queue, QueueMessage } from "@puck/core";

/** The slice of the logger `drain` needs — injected so `drain` stays pure and
 * testable without pulling in the env-bound logger singleton. */
export interface DrainLogger {
  error(obj: unknown, msg: string): void;
}

/**
 * Read a batch from `queue`, run `handle` per message, and settle each message
 * on the SAME queue according to the returned outcome:
 *   ack     → delete; retry → leave for redelivery; archive → dead-letter.
 * A thrown handler leaves the message for redelivery.
 */
export async function drain<T>(
  queue: Queue<T>,
  handle: (message: QueueMessage<T>) => Promise<DeliveryOutcome>,
  log: DrainLogger,
): Promise<number> {
  const messages = await queue.read({ max: 10, visibilitySeconds: 30 });
  for (const message of messages) {
    try {
      const outcome = await handle(message);
      if (outcome === "ack") {
        await queue.ack(message.id);
      } else if (outcome === "archive") {
        await queue.archive(message.id);
      }
      // "retry": leave it; pgmq redelivers after the visibility timeout.
    } catch (error) {
      log.error(
        { err: error, messageId: message.id },
        "failed to process message; leaving for redelivery",
      );
    }
  }
  return messages.length;
}
