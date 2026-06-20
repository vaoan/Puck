import { loadEnv } from "@puck/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.js";

export type PuckSupabaseClient = SupabaseClient<Database>;

/**
 * Service-role Supabase client for server-side use (api + worker).
 *
 * The service-role key bypasses RLS, so this client must NEVER be exposed to
 * a browser or untrusted context — it only ever runs inside Puck's backend
 * processes. User-facing access should go through an RLS-scoped anon client.
 */
export function createServiceClient(): PuckSupabaseClient {
  const env = loadEnv();
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
