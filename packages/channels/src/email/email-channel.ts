import type {
  DeliveryResult,
  DeliveryTarget,
  NotificationChannel,
  RenderedMessage,
} from "@puck/core";
import { Resend } from "resend";

export type EmailProviderKind = "console" | "resend" | "smtp";

export interface EmailChannelOptions {
  provider: EmailProviderKind;
  from: string;
  resendApiKey?: string;
  smtpUrl?: string;
}

/** Internal seam: an email transport. Swap providers without touching the
 * channel contract the worker depends on. */
interface EmailSender {
  send(input: {
    to: string;
    from: string;
    subject: string;
    text: string;
  }): Promise<DeliveryResult>;
}

/** Default, credential-free transport: logs instead of sending. Lets the whole
 * pipeline run end-to-end locally with zero setup. */
function createConsoleSender(): EmailSender {
  return {
    async send({ to, subject }) {
      // eslint-disable-next-line no-console -- intentional dev transport
      console.info(`[email:console] → ${to} :: ${subject}`);
      return { ok: true, providerRef: "console" };
    },
  };
}

function createResendSender(apiKey: string): EmailSender {
  const resend = new Resend(apiKey);
  return {
    async send({ to, from, subject, text }) {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        text,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, providerRef: data?.id };
    },
  };
}

function resolveSender(options: EmailChannelOptions): EmailSender {
  switch (options.provider) {
    case "resend":
      if (!options.resendApiKey) {
        throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
      }
      return createResendSender(options.resendApiKey);
    case "smtp":
      // Placeholder: add a nodemailer-based sender here when SMTP is needed.
      throw new Error("SMTP email provider is not implemented yet");
    case "console":
    default:
      return createConsoleSender();
  }
}

export function createEmailChannel(
  options: EmailChannelOptions,
): NotificationChannel {
  const sender = resolveSender(options);

  return {
    key: "email",

    async send(
      message: RenderedMessage,
      target: DeliveryTarget,
    ): Promise<DeliveryResult> {
      return sender.send({
        to: target.address,
        from: options.from,
        subject: message.title,
        text: message.body,
      });
    },
  };
}
