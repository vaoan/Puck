import { describe, expect, it, vi } from "vitest";

import type { EventChange, PuckEvent } from "../domain/events.js";
import type { ChannelSubscription } from "../domain/follows.js";
import type { DeliveryResult, Notification } from "../domain/notifications.js";
import type {
  ChannelRegistry,
  NotificationChannel,
} from "../ports/notification-channel.js";

import { deliverNotification, type DeliverDeps } from "./deliver.js";

const event: PuckEvent = {
  id: "evt1",
  externalId: null,
  source: "puck",
  title: "Launch Night",
  status: "scheduled",
  startsAt: "2026-06-20T18:00:00Z",
  location: "Hall A",
  organizerId: null,
  createdAt: "2026-06-19T00:00:00Z",
  updatedAt: "2026-06-19T00:00:00Z",
};

const change: EventChange = {
  id: "ec1",
  eventId: "evt1",
  type: "delayed",
  payload: {},
  dedupeKey: "k",
  createdAt: "2026-06-19T00:00:00Z",
};

const subscription: ChannelSubscription = {
  id: "s1",
  userId: "u1",
  channel: "telegram",
  address: "999",
  verified: true,
  createdAt: "2026-06-19T00:00:00Z",
};

function pendingNotification(): Notification {
  return {
    id: "n1",
    eventChangeId: "ec1",
    subscriptionId: "s1",
    channel: "telegram",
    dedupeKey: "k",
    status: "pending",
    attempts: 0,
    createdAt: "2026-06-19T00:00:00Z",
    sentAt: null,
  };
}

function makeDeps(
  notification: Notification | null,
  sendResult: DeliveryResult,
): { deps: DeliverDeps; calls: Record<string, ReturnType<typeof vi.fn>> } {
  const channel: NotificationChannel = {
    key: "telegram",
    send: vi.fn(async () => sendResult),
  };
  const registry: ChannelRegistry = {
    get: () => channel,
    require: () => channel,
    keys: () => ["telegram"],
  };

  const calls = {
    markSent: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    bumpAttempts: vi.fn(async () => {}),
    markSkipped: vi.fn(async () => {}),
    recordAttempt: vi.fn(async () => {}),
    send: channel.send as ReturnType<typeof vi.fn>,
  };

  const deps: DeliverDeps = {
    notifications: {
      getById: async () => notification,
      createIfAbsent: async () => ({
        notification: pendingNotification(),
        created: true,
      }),
      markSent: calls.markSent,
      markFailed: calls.markFailed,
      bumpAttempts: calls.bumpAttempts,
      markSkipped: calls.markSkipped,
      recordAttempt: calls.recordAttempt,
    },
    eventChanges: { getById: async () => change },
    events: { getById: async () => event },
    subscriptions: {
      getById: async () => subscription,
      listVerifiedForUser: async () => [subscription],
    },
    registry,
    now: () => "2026-06-19T12:00:00Z",
    maxAttempts: 3,
  };

  return { deps, calls };
}

describe("deliverNotification", () => {
  it("sends and marks sent on success", async () => {
    const { deps, calls } = makeDeps(pendingNotification(), { ok: true });
    const outcome = await deliverNotification("n1", deps);

    expect(outcome).toBe("ack");
    expect(calls.send).toHaveBeenCalledOnce();
    expect(calls.markSent).toHaveBeenCalledWith("n1", "2026-06-19T12:00:00Z");
  });

  it("acks without sending when the notification is already handled", async () => {
    const sent = { ...pendingNotification(), status: "sent" as const };
    const { deps, calls } = makeDeps(sent, { ok: true });

    const outcome = await deliverNotification("n1", deps);
    expect(outcome).toBe("ack");
    expect(calls.send).not.toHaveBeenCalled();
  });

  it("archives on a permanent failure", async () => {
    const { deps, calls } = makeDeps(pendingNotification(), {
      ok: false,
      permanent: true,
      error: "bot blocked",
    });

    const outcome = await deliverNotification("n1", deps);
    expect(outcome).toBe("archive");
    expect(calls.markFailed).toHaveBeenCalled();
  });

  it("retries (keeps pending) on a transient failure under the cap", async () => {
    const { deps, calls } = makeDeps(pendingNotification(), {
      ok: false,
      error: "rate limited",
    });

    const outcome = await deliverNotification("n1", deps);
    expect(outcome).toBe("retry");
    expect(calls.bumpAttempts).toHaveBeenCalledWith("n1", 1);
    expect(calls.markFailed).not.toHaveBeenCalled();
  });

  it("archives once attempts are exhausted", async () => {
    const exhausted = { ...pendingNotification(), attempts: 2 };
    const { deps, calls } = makeDeps(exhausted, { ok: false, error: "5xx" });

    const outcome = await deliverNotification("n1", deps);
    expect(outcome).toBe("archive");
    expect(calls.markFailed).toHaveBeenCalledWith("n1", 3);
  });
});
