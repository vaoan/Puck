import type { NotificationChannel } from "@puck/core";
import { describe, expect, it } from "vitest";

import { createChannelRegistry } from "./registry.js";

const fakeChannel = (key: NotificationChannel["key"]): NotificationChannel => ({
  key,
  send: async () => ({ ok: true }),
});

describe("createChannelRegistry", () => {
  it("resolves a registered channel by key", () => {
    const registry = createChannelRegistry([fakeChannel("telegram")]);
    expect(registry.require("telegram").key).toBe("telegram");
    expect(registry.keys()).toEqual(["telegram"]);
  });

  it("throws when requiring an unregistered channel", () => {
    const registry = createChannelRegistry([]);
    expect(() => registry.require("email")).toThrowError(/email/);
  });
});
