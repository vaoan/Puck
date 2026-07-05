import { describe, it, expect } from "vitest";

import { needsAuthRedirect } from "./middleware-session";

describe("needsAuthRedirect", () => {
  it("protects account when there is no session", () => {
    expect(needsAuthRedirect("/en/account", false)).toBe(true);
    expect(needsAuthRedirect("/es/account", false)).toBe(true);
    expect(needsAuthRedirect("/en/account/settings", false)).toBe(true);
  });

  it("allows account when authenticated", () => {
    expect(needsAuthRedirect("/en/account", true)).toBe(false);
  });

  it("never redirects public routes", () => {
    expect(needsAuthRedirect("/en/login", false)).toBe(false);
    expect(needsAuthRedirect("/en", false)).toBe(false);
    expect(needsAuthRedirect("/es", false)).toBe(false);
  });
});
