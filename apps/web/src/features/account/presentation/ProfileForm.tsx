"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { profileFormSchema } from "@/features/account/domain/schema";
import type {
  ProfileFormInput,
  ProfileFormValues,
} from "@/features/account/domain/schema";
import type { Profile } from "@/features/account/domain/types";
import { tid } from "@/shared/infrastructure/config/tid";

import { Button, Input, Label } from "@puck/ui";

interface ProfileFormProps {
  profile: Profile;
  onSubmit: (values: ProfileFormValues) => void;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export function ProfileForm({
  profile,
  onSubmit,
  isPending,
  isSuccess,
  isError,
}: ProfileFormProps) {
  const t = useTranslations("account");
  const tc = useTranslations("common");

  // Schema messages are i18n key suffixes (see domain/schema.ts).
  const errorText = (code?: string) => (code ? t(`errors.${code}`) : null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      display_name: profile.display_name ?? "",
      avatar_url: profile.avatar_url ?? "",
    },
  });

  // A successful save makes the current values the new baseline, so the form
  // reads as clean until the user edits again.
  useEffect(() => {
    if (isSuccess) reset(undefined, { keepValues: true });
  }, [isSuccess, reset]);

  let saveLabel = tc("save");
  if (isPending) saveLabel = tc("loading");
  else if (isSuccess && !isDirty) saveLabel = tc("saved");

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values))}
      className="flex flex-col gap-4"
      {...tid("profile-form")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">{t("displayName")}</Label>
        <Input
          id="display_name"
          {...register("display_name")}
          {...tid("profile-display-name")}
        />
        {errors.display_name ? (
          <p
            className="text-destructive text-sm"
            {...tid("profile-display-name-error")}
          >
            {errorText(errors.display_name.message)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="avatar_url">{t("avatarUrl")}</Label>
        <Input
          id="avatar_url"
          {...register("avatar_url")}
          {...tid("profile-avatar-url")}
        />
        {errors.avatar_url ? (
          <p
            className="text-destructive text-sm"
            {...tid("profile-avatar-url-error")}
          >
            {errorText(errors.avatar_url.message)}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} {...tid("profile-save")}>
        {saveLabel}
      </Button>

      {isError ? (
        <p className="text-destructive text-sm">{tc("error")}</p>
      ) : null}
    </form>
  );
}
