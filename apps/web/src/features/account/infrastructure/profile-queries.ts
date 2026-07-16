import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileFormValues } from "@/features/account/domain/schema";
import type { Profile } from "@/features/account/domain/types";

import type { Database } from "@puck/db";

// PII rule: email/provider are NOT readable by authenticated users (foundation 0013).
export const PROFILE_COLUMNS =
  "id, display_name, avatar_url, first_seen_at, last_seen_at, created_at, updated_at";

export async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  values: ProfileFormValues,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("user_profiles")
    .update(values)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as Profile;
}
