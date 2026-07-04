import { env } from "@/shared/infrastructure/config/env";

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Extract the Supabase project ref (first hostname label) from a project URL. */
export function deriveProjectRef(url: string): string {
  const [ref] = new URL(url).hostname.split(".");
  return ref ?? "";
}

export const SUPABASE_COOKIE_KEY = `sb-${deriveProjectRef(SUPABASE_URL)}-auth-token`;
