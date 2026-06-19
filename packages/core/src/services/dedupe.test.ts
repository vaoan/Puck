import { describe, expect, it } from "vitest";

import { notificationDedupeKey } from "./dedupe.js";

describe("notificationDedupeKey", () => {
  it("is deterministic for the same triple", () => {
    const input = {
      eventChangeId: "ec1",
      subscriptionId: "sub1",
      channel: "telegram" as const,
    };
    expect(notificationDedupeKey(input)).toBe(notificationDedupeKey(input));
  });

  it("differs across channels for the same change + subscription", () => {
    const base = { eventChangeId: "ec1", subscriptionId: "sub1" };
    expect(notificationDedupeKey({ ...base, channel: "telegram" })).not.toBe(
      notificationDedupeKey({ ...base, channel: "email" }),
    );
  });
});
