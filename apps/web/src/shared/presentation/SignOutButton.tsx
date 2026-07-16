"use client";

import { useTranslations } from "next-intl";

import { useAuth } from "@/shared/application/hooks/useAuth";
import { tid } from "@/shared/infrastructure/config/tid";
import { useRouter } from "@/shared/infrastructure/i18n";

import { Button } from "@puck/ui";

export function SignOutButton() {
  const t = useTranslations("auth");
  const { signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleSignOut}
      {...tid("sign-out")}
    >
      {t("signOut")}
    </Button>
  );
}
