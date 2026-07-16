import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Read a required env var or throw a clear E2E setup error. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Start local Supabase (pnpm db:start) and load the E2E env before running e2e tests.`,
    );
  }
  return value;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5000";

/** Session lifetime (seconds) for the injected cookie payload. */
const SESSION_EXPIRY_SECONDS = 3600;

/**
 * base64url encoding, matching how `@supabase/ssr` serializes cookie values —
 * standard btoa() emits +/= which `stringFromBase64URL` rejects.
 */
function toBase64URL(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Mirror of `deriveProjectRef` in
 * `src/shared/infrastructure/supabase/config.ts` — the first hostname label.
 * The injected cookie name MUST equal the app's `SUPABASE_COOKIE_KEY`.
 */
function deriveProjectRef(url: string): string {
  const [ref] = new URL(url).hostname.split(".");
  return ref ?? "";
}

const COOKIE_KEY = `sb-${deriveProjectRef(SUPABASE_URL)}-auth-token`;

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TestUser {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Create a confirmed test user via the admin API and sign in for real tokens.
 * The foundation triggers auto-create the `user_profiles` row + default
 * consumer permissions — no manual profile seeding needed.
 */
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${Date.now()}@test.invalid`;
  const password = `test-${Date.now()}`;

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createError || !created.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`);
  }

  const { data: session, error: signInError } =
    await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (signInError || !session.session) {
    throw new Error(`Failed to sign in test user: ${signInError?.message}`);
  }

  return {
    userId: created.user.id,
    email,
    accessToken: session.session.access_token,
    refreshToken: session.session.refresh_token,
  };
}

/**
 * Inject a real Supabase session into the browser context as the
 * `@supabase/ssr` cookie the middleware + server client read. localhost only —
 * no shared root domain.
 */
export async function injectSession(
  context: BrowserContext,
  user: TestUser,
): Promise<void> {
  const payload = JSON.stringify({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    token_type: "bearer",
    expires_in: SESSION_EXPIRY_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS,
    user: { id: user.userId, email: user.email },
  });
  const value = `base64-${toBase64URL(payload)}`;

  await context.clearCookies();
  // Use `url` (not domain/path) — the reliable way to scope a cookie to
  // localhost in Playwright. The session fits one cookie (no chunking needed).
  await context.addCookies([
    {
      name: COOKIE_KEY,
      value,
      url: BASE_URL,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ]);
}

/** Delete a test user (fixture teardown). */
export async function deleteTestUser(userId: string): Promise<void> {
  await supabaseAdmin.auth.admin.deleteUser(userId);
}
