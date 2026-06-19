import { describe, expect, it } from "vitest";

import type { EventChange } from "../domain/events.js";
import type { ChannelSubscription, Follow } from "../domain/follows.js";
import type { Notification } from "../domain/notifications.js";
import type { NotificationJob, Queue } from "../ports/queue.js";
import type {
  NewNotification,
  NotificationRepository,
} from "../ports/repositories.js";

import { fanOutEventChange, type FanOutDeps } from "./fan-out.js";

const change: EventChange = {
  id: "ec1",
  eventId: "evt1",
  type: "delayed",
  payload: {},
  dedupeKey: "evt1:delayed",
  createdAt: "2026-06-19T00:00:00Z",
};

const follow: Follow = {
  id: "f1",
  userId: "u1",
  eventId: "evt1",
  mutedTypes: [],
  createdAt: "2026-06-19T00:00:00Z",
};

const sub: ChannelSubscription = {
  id: "s1",
  userId: "u1",
  channel: "telegram",
  address: "12345",
  verified: true,
  createdAt: "2026-06-19T00:00:00Z",
};

/** Notification repo that enforces dedupe-key uniqueness, like the database. */
function makeNotificationRepo(): NotificationRepository {
  const byKey = new Map<string, Notification>();
  return {
    getById: async (id) =>
      [...byKey.values()].find((n) => n.id === id) ?? null,
    createIfAbsent: async (input: NewNotification) => {
      const existing = byKey.get(input.dedupeKey);
      if (existing) return existing;
      const created: Notification = {
        id: `n${byKey.size + 1}`,
        eventChangeId: input.eventChangeId,
        subscriptionId: input.subscriptionId,
        channel: input.channel as Notification["channel"],
        dedupeKey: input.dedupeKey,
        status: "pending",
        attempts: 0,
        createdAt: "2026-06-19T00:00:00Z",
        sentAt: null,
      };
      byKey.set(input.dedupeKey, created);
      return created;
    },
    markSent: async () => undefined,
    markFailed: async () => undefined,
    bumpAttempts: async () => undefined,
    markSkipped: async () => undefined,
    recordAttempt: async () => undefined,
  };
}

function makeDeps(notifications: NotificationRepository): {
  deps: FanOutDeps;
  enqueued: NotificationJob[];
} {
  const enqueued: NotificationJob[] = [];
  const queue: Queue<NotificationJob> = {
    send: async (payload) => void enqueued.push(payload),
    read: async () => [],
    ack: async () => undefined,
    archive: async () => undefined,
  };
  return {
    enqueued,
    deps: {
      eventChanges: { getById: async () => change },
      follows: { listFollowersForEvent: async () => [follow] },
      subscriptions: { listVerifiedForUser: async () => [sub] },
      notifications,
      queue,
    },
  };
}

describe("fanOutEventChange", () => {
  it("creates and enqueues one notification per verified subscription", async () => {
    const { deps, enqueued } = makeDeps(makeNotificationRepo());
    const result = await fanOutEventChange("ec1", deps);

    expect(result).toEqual({ created: 1, enqueued: 1, skipped: 0 });
    expect(enqueued).toHaveLength(1);
  });

  it("never enqueues twice when the same change is replayed (dedupe)", async () => {
    const repo = makeNotificationRepo();
    const { deps, enqueued } = makeDeps(repo);

    await fanOutEventChange("ec1", deps);
    const second = await fanOutEventChange("ec1", deps);

    expect(second.enqueued).toBe(0);
    expect(second.skipped).toBe(1);
    expect(enqueued).toHaveLength(1);
  });

  it("skips muted change types", async () => {
    const { deps, enqueued } = makeDeps(makeNotificationRepo());
    deps.follows.listFollowersForEvent = async () => [
      { ...follow, mutedTypes: ["delayed"] },
    ];

    const result = await fanOutEventChange("ec1", deps);
    expect(result.skipped).toBe(1);
    expect(enqueued).toHaveLength(0);
  });
});
