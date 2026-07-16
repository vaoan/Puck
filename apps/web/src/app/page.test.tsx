import { describe, it, expect, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));
vi.mock("@/shared/infrastructure/i18n", () => ({
  routing: { defaultLocale: "en" },
}));

import RootPage from "./page";

describe("RootPage", () => {
  it("redirects the bare root to the default locale", () => {
    RootPage();
    expect(redirect).toHaveBeenCalledWith("/en");
  });
});
