"use client";

import { useTranslations } from "next-intl";

import { tid } from "@/shared/infrastructure/config/tid";
import { Link } from "@/shared/infrastructure/i18n";

export function Nav() {
  const t = useTranslations("nav");
  return (
    <nav
      {...tid("app-nav")}
      className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6"
    >
      <span className="text-lg font-bold text-brand">{t("brand")}</span>
      <Link
        href="/account"
        {...tid("nav-account")}
        className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        {t("account")}
      </Link>
    </nav>
  );
}
