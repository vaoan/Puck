import { useQuery } from "@tanstack/react-query";

import {
  PROFILE_QUERY_KEY,
  PROFILE_STALE_TIME_MS,
} from "@/features/account/domain/constants";
import { fetchProfile } from "@/features/account/infrastructure/profile-queries";
import { useSupabase } from "@/shared/application/hooks/useSupabase";

export function useProfile(userId?: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY, userId],
    queryFn: () => {
      if (!userId) throw new Error("useProfile requires a userId");
      return fetchProfile(supabase, userId);
    },
    enabled: !!userId,
    staleTime: PROFILE_STALE_TIME_MS,
  });
}
