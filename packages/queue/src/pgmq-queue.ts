/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Supabase RPC results
   are untyped; the pgmq row shape is cast to PgmqRow at the boundary below. */
import type { Queue, QueueMessage } from "@puck/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A {@link Queue} backed by pgmq running inside Supabase Postgres.
 *
 * Calls go through thin public-schema SQL wrappers (`puck_queue_*`) defined in
 * the migrations, so the app only needs RPC access — no direct pgmq schema
 * grants. Because the queue is the same Postgres we already run, this adds no
 * infrastructure and no recurring cost.
 */
export const NOTIFICATIONS_QUEUE = "puck_notifications";
export const FANOUT_QUEUE = "puck_fanout";

interface PgmqRow {
  msg_id: number;
  read_ct: number;
  message: unknown;
}

export function createPgmqQueue<T>(
  client: SupabaseClient,
  queueName: string = NOTIFICATIONS_QUEUE,
): Queue<T> {
  return {
    async send(payload, options) {
      const { error } = await client.rpc("puck_queue_send", {
        queue_name: queueName,
        msg: payload,
        delay_seconds: options?.delaySeconds ?? 0,
      });
      if (error) throw new Error(`queue send failed: ${error.message}`);
    },

    async read(options) {
      const { data, error } = await client.rpc("puck_queue_read", {
        queue_name: queueName,
        qty: options?.max ?? 10,
        visibility_seconds: options?.visibilitySeconds ?? 30,
      });
      if (error) throw new Error(`queue read failed: ${error.message}`);

      return ((data ?? []) as PgmqRow[]).map(
        (row): QueueMessage<T> => ({
          id: String(row.msg_id),
          readCount: row.read_ct,
          payload: row.message as T,
        }),
      );
    },

    async ack(messageId) {
      const { error } = await client.rpc("puck_queue_delete", {
        queue_name: queueName,
        msg_id: Number(messageId),
      });
      if (error) throw new Error(`queue ack failed: ${error.message}`);
    },

    async archive(messageId) {
      const { error } = await client.rpc("puck_queue_archive", {
        queue_name: queueName,
        msg_id: Number(messageId),
      });
      if (error) throw new Error(`queue archive failed: ${error.message}`);
    },
  };
}
