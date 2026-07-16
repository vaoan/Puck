import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PROFILE_QUERY_KEY } from "@/features/account/domain/constants";
import type { ProfileFormValues } from "@/features/account/domain/schema";
import { updateProfile } from "@/features/account/infrastructure/profile-queries";
import { useSupabase } from "@/shared/application/hooks/useSupabase";

export function useUpdateProfile(userId: string) {
  const supabase = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateProfile(supabase, userId, values),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY, userId] }),
  });
}
