import { timingSafeEqual } from "node:crypto";

import { EVENT_CHANGE_TYPES } from "@puck/core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import type { ApiContext } from "../context.js";

const INTERNAL_KEY_HEADER = "x-puck-internal-key";

const changeBody = z.object({
  eventId: z.uuid(),
  type: z.enum(EVENT_CHANGE_TYPES),
  dedupeKey: z.string().min(1),
  payload: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    })
    .default({}),
});

/**
 * Intake for event changes (organizer announcements, status/location/schedule
 * updates, check-in events, or upstream sync from Janus).
 *
 * The handler only persists the change (idempotent on `dedupeKey`). A DB
 * trigger enqueues a fan-out job in the SAME transaction (outbox pattern), and
 * the worker expands it into notifications — so a change reliably "creates
 * jobs" without the request waiting on delivery.
 */
export function registerEventChangeRoutes(
  app: FastifyInstance,
  ctx: ApiContext,
): void {
  app.post("/internal/event-changes", async (request, reply) => {
    if (!isAuthorized(request, ctx)) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const parsed = changeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: z.flattenError(parsed.error) });
    }
    const input = parsed.data;

    const { error } = await ctx.client.from("event_changes").upsert(
      {
        event_id: input.eventId,
        type: input.type,
        payload: input.payload,
        dedupe_key: input.dedupeKey,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (error) {
      request.log.error({ err: error }, "failed to persist event change");
      return reply.status(500).send({ error: "failed to record change" });
    }

    // 202: accepted for async fan-out + delivery by the worker.
    return reply.status(202).send({ accepted: true });
  });
}

/**
 * Guard for service-to-service intake. Requires a configured INTERNAL_API_KEY
 * and a constant-time match on the `x-puck-internal-key` header. Fails closed:
 * if no key is configured, the endpoint rejects everything rather than running
 * wide open.
 */
function isAuthorized(request: FastifyRequest, ctx: ApiContext): boolean {
  const expected = ctx.env.INTERNAL_API_KEY;
  if (!expected) return false;

  // eslint-disable-next-line security/detect-object-injection -- constant header name, not user input
  const provided = request.headers[INTERNAL_KEY_HEADER];
  if (typeof provided !== "string") return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
