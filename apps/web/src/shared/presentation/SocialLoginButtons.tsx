"use client";

import { useTranslations } from "next-intl";

import {
  useAuth,
  type OAuthProvider,
} from "@/shared/application/hooks/useAuth";
import { tid } from "@/shared/infrastructure/config/tid";

import { Button } from "@puck/ui";

export function SocialLoginButtons({ returnTo = "/" }: { returnTo?: string }) {
  const t = useTranslations("auth.login");
  const { signInWithProvider } = useAuth();

  const go = (provider: OAuthProvider) =>
    signInWithProvider(
      provider,
      `${globalThis.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
    );

  return (
    <div className="flex flex-col gap-3">
      <Button {...tid("login-google")} onClick={() => go("google")}>
        {t("google")}
      </Button>
      <Button
        {...tid("login-discord")}
        variant="outline"
        onClick={() => go("discord")}
      >
        {t("discord")}
      </Button>
    </div>
  );
}
