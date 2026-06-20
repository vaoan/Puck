import type { Env } from "@puck/config";
import type { ChannelRegistry, NotificationChannel } from "@puck/core";

import { createEmailChannel } from "./email/email-channel.js";
import { createChannelRegistry } from "./registry.js";
import { createTelegramChannel } from "./telegram/telegram-channel.js";

export { createChannelRegistry } from "./registry.js";
export { createTelegramChannel } from "./telegram/telegram-channel.js";
export { createEmailChannel } from "./email/email-channel.js";

/**
 * Build the channel registry from validated env. Only configured channels are
 * registered — e.g. Telegram is skipped when no bot token is present — so the
 * service degrades gracefully rather than crashing.
 */
export function buildChannelRegistry(env: Env): ChannelRegistry {
  const channels: NotificationChannel[] = [
    createEmailChannel({
      provider: env.EMAIL_PROVIDER,
      from: env.EMAIL_FROM,
      resendApiKey: env.RESEND_API_KEY,
      smtpUrl: env.SMTP_URL,
    }),
  ];

  if (env.TELEGRAM_BOT_TOKEN) {
    channels.push(createTelegramChannel({ botToken: env.TELEGRAM_BOT_TOKEN }));
  }

  return createChannelRegistry(channels);
}
