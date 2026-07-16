import { describe, it, expect } from "vitest";

import {
  isExcluded,
  resolveLocale,
} from "@/shared/infrastructure/routing/proxy-routing";

describe("isExcluded", () => {
  it("skips Next internals and the API", () => {
    expect(isExcluded("/_next/static/chunks/main.js")).toBe(true);
    expect(isExcluded("/_next/image")).toBe(true);
    expect(isExcluded("/api/health")).toBe(true);
  });

  it("skips locale-prefixed asset paths", () => {
    expect(isExcluded("/en/_next/static/chunks/main.js")).toBe(true);
    expect(isExcluded("/en/api/health")).toBe(true);
  });

  it("skips the OAuth callback and root files", () => {
    expect(isExcluded("/auth/callback")).toBe(true);
    expect(isExcluded("/favicon.ico")).toBe(true);
  });

  it("does not skip real pages", () => {
    expect(isExcluded("/en/account")).toBe(false);
    expect(isExcluded("/en/login")).toBe(false);
    expect(isExcluded("/")).toBe(false);
  });

  // A protected route must never be skipped just because a path segment
  // happens to contain a dot — that would silently bypass authentication.
  it("never skips a protected route containing a dot", () => {
    expect(isExcluded("/en/account/my-fest-v1.0")).toBe(false);
    expect(isExcluded("/account/export.csv")).toBe(false);
  });
});

describe("resolveLocale", () => {
  it("returns the locale when the path is locale-prefixed", () => {
    expect(resolveLocale("/en/account")).toBe("en");
    expect(resolveLocale("/es/account")).toBe("es");
  });

  // Guards the redirect loop: an unprefixed /account must not yield
  // locale "account" and redirect to /account/login (which redirects to itself).
  it("falls back to the default locale for unprefixed paths", () => {
    expect(resolveLocale("/account")).toBe("en");
    expect(resolveLocale("/account/settings")).toBe("en");
    expect(resolveLocale("/")).toBe("en");
  });

  it("falls back to the default locale for unsupported locales", () => {
    expect(resolveLocale("/fr/account")).toBe("en");
    expect(resolveLocale("/de")).toBe("en");
  });
});
