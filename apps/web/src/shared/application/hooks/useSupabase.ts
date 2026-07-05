import { useMemo } from "react";

import { createBrowserSupabaseClient } from "@/shared/infrastructure/supabase/browser-client";

export function useSupabase() {
  return useMemo(() => createBrowserSupabaseClient(), []);
}
