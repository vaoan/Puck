/**
 * Minimal queue abstraction. Puck's default implementation is pgmq (a queue
 * living inside the Supabase Postgres we already pay for — zero extra infra),
 * but nothing in core or the worker depends on that choice. Swap in SQS,
 * BullMQ, etc. by providing another implementation of this port.
 */
export interface QueueMessage<T> {
  /** Queue-assigned id, used to delete/ack the message after handling. */
  id: string;
  /** Number of times this message has been read (for retry/backoff caps). */
  readCount: number;
  payload: T;
}

export interface Queue<T> {
  /** Enqueue a payload, optionally delayed by N seconds (for scheduling). */
  send(payload: T, options?: { delaySeconds?: number }): Promise<void>;

  /** Read up to `max` messages, hiding them for `visibilitySeconds`. */
  read(options?: {
    max?: number;
    visibilitySeconds?: number;
  }): Promise<QueueMessage<T>[]>;

  /** Acknowledge successful handling — removes the message. */
  ack(messageId: string): Promise<void>;

  /** Park a permanently-failed message for later inspection. */
  archive(messageId: string): Promise<void>;
}

/** Payload on the fan-out queue: "expand this event change into
 * notifications". Enqueued transactionally by a DB trigger (the outbox). */
export interface FanOutJob {
  eventChangeId: string;
}

/** Payload on the delivery queue: "deliver this one notification". */
export interface NotificationJob {
  notificationId: string;
}
