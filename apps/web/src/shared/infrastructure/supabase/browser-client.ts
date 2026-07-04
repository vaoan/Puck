import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_KEY } from "./config";

import type { Database } from "@puck/db";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createBrowserSupabaseClient() {
  if (client) return client;
  client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
  });
  return client;
}
