import { getTranslations } from "next-intl/server";

import { tid } from "@/shared/infrastructure/config/tid";
import { SocialLoginButtons } from "@/shared/presentation/SocialLoginButtons";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6"
      {...tid("login")}
    >
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <SocialLoginButtons />
    </main>
  );
}
