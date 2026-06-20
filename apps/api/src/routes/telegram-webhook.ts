import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";

import type { ApiContext } from "../context.js";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * Telegram webhook receiver (production transport).
 *
 * Security: Telegram echoes our configured secret in the
 * `X-Telegram-Bot-Api-Secret-Token` header on every call. We reject anything
 * that doesn't match (constant-time compare), so only Telegram can post here.
 *
 * The route is only registered when a webhook secret is configured; in local
 * dev the worker/bot uses long polling instead and this endpoint is absent.
 */
export function registerTelegramWebhook(
  app: FastifyInstance,
  ctx: ApiContext,
): void {
  const secret = ctx.env.TELEGRAM_WEBHOOK_SECRET;
  if (ctx.env.TELEGRAM_MODE !== "webhook" || !secret) {
    return;
  }

  app.post("/telegram/webhook", async (request, reply) => {
    // eslint-disable-next-line security/detect-object-injection -- constant header name, not user input
    const provided = request.headers[SECRET_HEADER];
    if (typeof provided !== "string" || !safeEqual(provided, secret)) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    // TODO: hand `request.body` to a grammY bot to handle commands like /start
    // (register a chat as a verified Telegram subscription) and /stop.
    request.log.info("received telegram update");
    return reply.status(200).send({ ok: true });
  });
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
