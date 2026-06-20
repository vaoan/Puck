import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createPgmqQueue, NOTIFICATIONS_QUEUE } from "./pgmq-queue.js";

interface RpcCall {
  name: string;
  args: unknown;
}

function makeClient(result: { data?: unknown; error: unknown }): {
  client: SupabaseClient;
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  const client = {
    rpc: (name: string, args: unknown) => {
      calls.push({ name, args });
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("createPgmqQueue", () => {
  it("send forwards the queue name, payload, and delay to puck_queue_send", async () => {
    const { client, calls } = makeClient({ error: null });
    const queue = createPgmqQueue(client, NOTIFICATIONS_QUEUE);

    await queue.send({ notificationId: "n1" }, { delaySeconds: 5 });

    expect(calls[0]).toEqual({
      name: "puck_queue_send",
      args: {
        queue_name: NOTIFICATIONS_QUEUE,
        msg: { notificationId: "n1" },
        delay_seconds: 5,
      },
    });
  });

  it("read maps pgmq rows into queue messages", async () => {
    const { client } = makeClient({
      data: [{ msg_id: 7, read_ct: 2, message: { notificationId: "n1" } }],
      error: null,
    });
    const queue = createPgmqQueue<{ notificationId: string }>(client);

    const messages = await queue.read();

    expect(messages).toEqual([
      { id: "7", readCount: 2, payload: { notificationId: "n1" } },
    ]);
  });

  it("throws when the RPC returns an error", async () => {
    const { client } = makeClient({ error: { message: "nope" } });
    const queue = createPgmqQueue(client);

    await expect(queue.send({})).rejects.toThrow("nope");
  });
});
