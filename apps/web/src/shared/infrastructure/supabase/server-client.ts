import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_KEY } from "./config";
import { mergeSupabaseCookieOptions } from "./cookies";

import type { Database } from "@puck/db";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
          }
        } catch {
          /* called from a Server Component — safe to ignore */
        }
      },
    },
  });
}
