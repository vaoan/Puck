import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import type { ApiContext } from "./context.js";
import { registerEventChangeRoutes } from "./routes/event-changes.js";
import { registerFollowRoutes } from "./routes/follows.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerTelegramWebhook } from "./routes/telegram-webhook.js";

/**
 * Build the Fastify app with security middleware and all routes registered.
 * Separated from `listen` so it can be exercised with `app.inject(...)` in
 * tests without binding a port.
 */
export async function buildServer(ctx: ApiContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: ctx.env.LOG_LEVEL },
  });

  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  registerHealthRoutes(app);
  registerFollowRoutes(app, ctx);
  registerEventChangeRoutes(app, ctx);
  registerTelegramWebhook(app, ctx);

  return app;
}
