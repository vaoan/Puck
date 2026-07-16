import { describe, it, expect, vi } from "vitest";

const redirect = vi.fn();
vi.mock("@/shared/infrastructure/i18n", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("redirects to the account page (interim landing until the events dashboard exists)", async () => {
    await HomePage({ params: Promise.resolve({ locale: "en" }) });
    expect(redirect).toHaveBeenCalledWith({ href: "/account", locale: "en" });
  });
});
