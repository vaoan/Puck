"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAuth } from "@/shared/application/hooks/useAuth";
import { tid } from "@/shared/infrastructure/config/tid";
import { useRouter } from "@/shared/infrastructure/i18n";

import { Button } from "@puck/ui";

export function SignOutButton() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { signOut } = useAuth();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  async function handleSignOut() {
    if (isPending) return;
    setIsPending(true);
    setHasFailed(false);
    try {
      await signOut();
      router.push("/login");
    } catch {
      // Stay on the page and say so — an unhandled rejection would leave the
      // button looking simply dead.
      setHasFailed(true);
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleSignOut}
        disabled={isPending}
        {...tid("sign-out")}
      >
        {t("signOut")}
      </Button>
      {hasFailed ? (
        <p className="text-destructive text-sm" {...tid("sign-out-error")}>
          {tc("error")}
        </p>
      ) : null}
    </div>
  );
}
