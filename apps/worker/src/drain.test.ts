import type { DeliveryOutcome, Queue, QueueMessage } from "@puck/core";
import { describe, expect, it } from "vitest";

import { drain, type DrainLogger } from "./drain.js";

const silentLog: DrainLogger = { error: () => {} };

function makeQueue<T>(messages: QueueMessage<T>[]): {
  queue: Queue<T>;
  acked: string[];
  archived: string[];
} {
  const acked: string[] = [];
  const archived: string[] = [];
  const queue: Queue<T> = {
    send: async () => {},
    read: async () => messages,
    ack: async (id) => {
      acked.push(id);
    },
    archive: async (id) => {
      archived.push(id);
    },
  };
  return { queue, acked, archived };
}

const msg = (id: string): QueueMessage<{ n: number }> => ({
  id,
  readCount: 0,
  payload: { n: 1 },
});

describe("drain", () => {
  it("acks every message whose handler returns 'ack'", async () => {
    const { queue, acked, archived } = makeQueue([msg("1"), msg("2")]);
    const handled = await drain(
      queue,
      async (): Promise<DeliveryOutcome> => "ack",
      silentLog,
    );
    expect(handled).toBe(2);
    expect(acked).toEqual(["1", "2"]);
    expect(archived).toEqual([]);
  });

  it("archives on 'archive' and leaves 'retry' in place", async () => {
    const { queue, acked, archived } = makeQueue([msg("a"), msg("b")]);
    const handled = await drain(
      queue,
      async (m): Promise<DeliveryOutcome> =>
        m.id === "a" ? "archive" : "retry",
      silentLog,
    );
    expect(handled).toBe(2);
    expect(archived).toEqual(["a"]);
    expect(acked).toEqual([]);
  });

  it("swallows handler errors and leaves the message for redelivery", async () => {
    const { queue, acked, archived } = makeQueue([msg("x")]);
    const handled = await drain(
      queue,
      async (): Promise<DeliveryOutcome> => {
        throw new Error("boom");
      },
      silentLog,
    );
    expect(handled).toBe(1);
    expect(acked).toEqual([]);
    expect(archived).toEqual([]);
  });
});
