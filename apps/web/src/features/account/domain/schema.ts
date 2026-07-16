import { z } from "zod";

import { DISPLAY_NAME_MAX_LENGTH } from "@/features/account/domain/constants";

/**
 * Validation messages are i18n key suffixes, not prose: the form resolves them
 * against the `account.errors` namespace so users see localised text rather
 * than zod's English defaults.
 */
export const profileFormSchema = z.object({
  display_name: z
    .string()
    .max(DISPLAY_NAME_MAX_LENGTH, { message: "displayNameTooLong" })
    .optional()
    .transform((v) => v?.trim() || null),
  avatar_url: z
    .string()
    .url({ message: "avatarUrlInvalid" })
    .startsWith("https://", { message: "avatarUrlInvalid" })
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : null)),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type ProfileFormInput = z.input<typeof profileFormSchema>;
