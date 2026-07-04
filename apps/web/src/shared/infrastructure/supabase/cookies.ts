import type { CookieOptions } from "@supabase/ssr";

import { isProduction } from "@/shared/infrastructure/config/env";

/** Localhost-friendly cookie options: `secure` only in production (no shared root domain). */
export function mergeSupabaseCookieOptions(
  options: CookieOptions,
): CookieOptions {
  return { ...options, secure: isProduction };
}
