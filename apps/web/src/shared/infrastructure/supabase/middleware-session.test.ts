import { describe, it, expect } from "vitest";

import { isProtectedPath, needsAuthRedirect } from "./middleware-session";

describe("needsAuthRedirect", () => {
  it("protects account when there is no session", () => {
    expect(needsAuthRedirect("/en/account", false)).toBe(true);
    expect(needsAuthRedirect("/es/account", false)).toBe(true);
    expect(needsAuthRedirect("/en/account/settings", false)).toBe(true);
  });

  it("protects account when the path has no locale prefix", () => {
    expect(needsAuthRedirect("/account", false)).toBe(true);
    expect(needsAuthRedirect("/account/settings", false)).toBe(true);
  });

  it("sends an unauthenticated visitor to a real login route", () => {
    // Regression: an unprefixed /account must resolve to the default locale,
    // not to a bogus "/account/login" that redirects to itself.
    expect(needsAuthRedirect("/en/login", false)).toBe(false);
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

describe("isProtectedPath", () => {
  it("ignores session state and reports route protection alone", () => {
    expect(isProtectedPath("/en/account")).toBe(true);
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/en/account/settings")).toBe(true);
  });

  it("reports public routes as unprotected", () => {
    expect(isProtectedPath("/en/login")).toBe(false);
    expect(isProtectedPath("/en")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });
});
