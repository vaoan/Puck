import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { ApiContext } from "../context.js";

const followBody = z.object({
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
});

/**
 * Follow / unfollow endpoints.
 *
 * NOTE: this scaffold trusts the body for `userId`. Before production, derive
 * the user from a verified Supabase JWT (Authorization header) and enforce RLS
 * so a caller can only manage their own follows.
 */
export function registerFollowRoutes(
  app: FastifyInstance,
  ctx: ApiContext,
): void {
  app.post("/follows", async (request, reply) => {
    const parsed = followBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { error } = await ctx.client
      .from("follows")
      .upsert(
        { user_id: parsed.data.userId, event_id: parsed.data.eventId },
        { onConflict: "user_id,event_id", ignoreDuplicates: true },
      );
    if (error) {
      request.log.error({ err: error }, "failed to create follow");
      return reply.status(500).send({ error: "failed to follow" });
    }

    return reply.status(201).send({ ok: true });
  });

  app.delete("/follows", async (request, reply) => {
    const parsed = followBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { error } = await ctx.client
      .from("follows")
      .delete()
      .eq("user_id", parsed.data.userId)
      .eq("event_id", parsed.data.eventId);
    if (error) {
      request.log.error({ err: error }, "failed to delete follow");
      return reply.status(500).send({ error: "failed to unfollow" });
    }

    return reply.status(204).send();
  });
}
