import { z } from "zod";

/**
 * Single source of truth for Puck's runtime configuration.
 *
 * Every process (api, worker) validates the environment once at startup via
 * {@link loadEnv}. Invalid or missing config fails fast and loudly rather than
 * surfacing as a confusing runtime error later — this is a deliberate
 * fail-safe: a misconfigured notifier is worse than one that refuses to boot.
 */
const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // API service
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(5200),
  PUBLIC_BASE_URL: z.string().url().optional(),
  // Shared secret guarding internal/service-to-service endpoints (e.g. event
  // change intake from Janus). Required in production.
  INTERNAL_API_KEY: z.string().optional(),

  // Worker
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // Telegram
  TELEGRAM_MODE: z.enum(["polling", "webhook"]).default("polling"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  EMAIL_FROM: z.string().default("Puck <noreply@example.com>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),

  // Internal flags (string booleans for env friendliness)
  CI: booleanish.optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parse and cache the environment. Pass an explicit source in tests.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid Puck environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test helper — clears the memoized env so a fresh source can be loaded. */
export function resetEnvCache(): void {
  cached = undefined;
}
