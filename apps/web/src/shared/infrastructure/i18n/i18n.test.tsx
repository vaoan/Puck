import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, it, expect } from "vitest";

import en from "./messages/en.json";
import es from "./messages/es.json";

function Probe() {
  const t = useTranslations("auth.login");
  return <span>{t("google")}</span>;
}

describe("i18n", () => {
  it("resolves a translation key from en messages", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Probe />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });

  it("keeps en and es key sets identical", () => {
    const keys = (obj: unknown, prefix = ""): string[] =>
      typeof obj === "object" && obj !== null
        ? Object.entries(obj).flatMap(([k, v]) =>
            typeof v === "object" && v !== null
              ? keys(v, `${prefix}${k}.`)
              : [`${prefix}${k}`],
          )
        : [];
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
});
