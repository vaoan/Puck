"use client";

import { useTranslations } from "next-intl";

import { useProfile } from "@/features/account/application/hooks/useProfile";
import { useUpdateProfile } from "@/features/account/application/hooks/useUpdateProfile";
import { ProfileForm } from "@/features/account/presentation/ProfileForm";
import { useAuth } from "@/shared/application/hooks/useAuth";
import { tid } from "@/shared/infrastructure/config/tid";
import { SignOutButton } from "@/shared/presentation/SignOutButton";

import { Skeleton } from "@puck/ui";

export function AccountPage() {
  const t = useTranslations("account");
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const update = useUpdateProfile(user?.id ?? "");

  return (
    <section className="flex flex-col gap-6" {...tid("account")}>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {/* PII rule: email comes from the session user, never from the profile row. */}
      <p className="text-muted-foreground">
        {t("email")}: {user?.email ?? "—"}
      </p>
      {isLoading || !profile ? (
        <Skeleton className="h-40 w-full" {...tid("account-loading")} />
      ) : (
        <ProfileForm
          profile={profile}
          onSubmit={update.mutate}
          isPending={update.isPending}
          isSuccess={update.isSuccess}
          isError={update.isError}
        />
      )}
      <SignOutButton />
    </section>
  );
}
