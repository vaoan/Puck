import { z } from "zod";

import { DISPLAY_NAME_MAX_LENGTH } from "@/features/account/domain/constants";

export const profileFormSchema = z.object({
  display_name: z
    .string()
    .max(DISPLAY_NAME_MAX_LENGTH)
    .optional()
    .transform((v) => v?.trim() || null),
  avatar_url: z
    .string()
    .url()
    .startsWith("https://")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : null)),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type ProfileFormInput = z.input<typeof profileFormSchema>;
