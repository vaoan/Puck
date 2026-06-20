import { buildChannelRegistry } from "@puck/channels";
import { loadEnv } from "@puck/config";
import {
  deliverNotification,
  fanOutEventChange,
  type DeliverDeps,
  type DeliveryOutcome,
  type FanOutDeps,
  type FanOutJob,
  type NotificationJob,
  type Queue,
} from "@puck/core";
import {
  createEventChangeRepository,
  createEventRepository,
  createFollowRepository,
  createNotificationRepository,
  createServiceClient,
  createSubscriptionRepository,
} from "@puck/db";
import {
  createPgmqQueue,
  FANOUT_QUEUE,
  NOTIFICATIONS_QUEUE,
} from "@puck/queue";

import { drain } from "./drain.js";
import { logger } from "./logger.js";

/**
 * The Puck worker: a long-running process that drains two queues —
 *
 *   puck_fanout        → expand an event change into per-follower notifications
 *   puck_notifications → deliver one notification through a channel
 *
 * It is deliberately stateless; all durability lives in Postgres (pgmq + the
 * notifications table), so the worker can crash and restart without losing or
 * duplicating work. Both stages are idempotent.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const client = createServiceClient();
  const registry = buildChannelRegistry(env);

  const fanoutQueue: Queue<FanOutJob> = createPgmqQueue(client, FANOUT_QUEUE);
  const notifyQueue: Queue<NotificationJob> = createPgmqQueue(
    client,
    NOTIFICATIONS_QUEUE,
  );

  const notifications = createNotificationRepository(client);
  const eventChanges = createEventChangeRepository(client);

  const fanOutDeps: FanOutDeps = {
    eventChanges,
    follows: createFollowRepository(client),
    subscriptions: createSubscriptionRepository(client),
    notifications,
    queue: notifyQueue,
  };

  const deliverDeps: DeliverDeps = {
    notifications,
    eventChanges,
    events: createEventRepository(client),
    subscriptions: createSubscriptionRepository(client),
    registry,
    now: () => new Date().toISOString(),
    maxAttempts: env.WORKER_MAX_ATTEMPTS,
  };

  let running = true;
  const stop = (signal: string): void => {
    logger.info({ signal }, "shutting down worker");
    running = false;
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  logger.info(
    { channels: registry.keys(), pollMs: env.WORKER_POLL_INTERVAL_MS },
    "puck worker started",
  );

  while (running) {
    const handledFanout = await drain(
      fanoutQueue,
      async (message): Promise<DeliveryOutcome> => {
        const result = await fanOutEventChange(
          message.payload.eventChangeId,
          fanOutDeps,
        );
        logger.debug(
          { ...result, eventChangeId: message.payload.eventChangeId },
          "fanned out event change",
        );
        return "ack";
      },
      logger,
    );

    const handledNotify = await drain(
      notifyQueue,
      (message) =>
        deliverNotification(message.payload.notificationId, deliverDeps),
      logger,
    );

    // Idle-sleep only when both queues were empty, so a backlog drains fast.
    if (handledFanout + handledNotify === 0) {
      await sleep(env.WORKER_POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  await main();
} catch (error) {
  logger.fatal({ err: error }, "worker crashed");
  process.exitCode = 1;
}
