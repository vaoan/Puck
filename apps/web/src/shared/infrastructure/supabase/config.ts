import { env } from "@/shared/infrastructure/config/env";

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Base URL for server-side Supabase API calls. Inside a container the public
 * URL (localhost) points at the container itself, so server code uses the
 * internal host when provided; everywhere else it is the public URL.
 */
export const SUPABASE_SERVER_URL =
  env.SUPABASE_URL_INTERNAL ?? env.NEXT_PUBLIC_SUPABASE_URL;

/** Extract the Supabase project ref (first hostname label) from a project URL. */
export function deriveProjectRef(url: string): string {
  const [ref] = new URL(url).hostname.split(".");
  return ref ?? "";
}

// Cookie key derives from the PUBLIC url so it matches the browser + E2E helper.
export const SUPABASE_COOKIE_KEY = `sb-${deriveProjectRef(SUPABASE_URL)}-auth-token`;
