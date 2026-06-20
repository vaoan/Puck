import type {
  DeliveryResult,
  DeliveryTarget,
  NotificationChannel,
  RenderedMessage,
} from "@puck/core";
import { Bot, GrammyError } from "grammy";

export interface TelegramChannelOptions {
  botToken: string;
}

/**
 * Telegram delivery via grammY. The target `address` is a chat id.
 *
 * Errors are classified so the worker's retry policy behaves well:
 *  - 403 (bot blocked) / 400 (bad chat) are permanent — don't retry.
 *  - 429 / 5xx are transient — let the queue redeliver with backoff.
 */
export function createTelegramChannel(
  options: TelegramChannelOptions,
): NotificationChannel {
  const bot = new Bot(options.botToken);

  return {
    key: "telegram",

    async send(
      message: RenderedMessage,
      target: DeliveryTarget,
    ): Promise<DeliveryResult> {
      const text = `*${escapeMarkdown(message.title)}*\n\n${escapeMarkdown(
        message.body,
      )}`;
      try {
        const sent = await bot.api.sendMessage(target.address, text, {
          parse_mode: "MarkdownV2",
        });
        return { ok: true, providerRef: String(sent.message_id) };
      } catch (error) {
        if (error instanceof GrammyError) {
          const permanent =
            error.error_code === 400 || error.error_code === 403;
          return { ok: false, error: error.description, permanent };
        }
        return {
          ok: false,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    },

    healthCheck() {
      return Promise.resolve(Boolean(options.botToken));
    },
  };
}

/** Escape the characters MarkdownV2 treats as special. */
function escapeMarkdown(input: string): string {
  return input.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, (char) => `\\${char}`);
}
