import { describe, it, expect, afterEach, vi } from "vitest";

import { deriveProjectRef } from "./config";

describe("deriveProjectRef", () => {
  it("extracts the project ref from a supabase url", () => {
    expect(deriveProjectRef("https://abcdxyz.supabase.co")).toBe("abcdxyz");
    expect(deriveProjectRef("http://localhost:54321")).toBe("localhost");
  });
});

const PUBLIC_URL = "http://localhost:54321";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabase config URL split", () => {
  it("uses the internal URL for server calls, public URL for the cookie key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PUBLIC_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_URL_INTERNAL", "http://host.docker.internal:54321");
    vi.resetModules();

    const mod = await import("./config");

    expect(mod.SUPABASE_SERVER_URL).toBe("http://host.docker.internal:54321");
    expect(mod.SUPABASE_COOKIE_KEY).toBe("sb-localhost-auth-token");
  });

  it("falls back to the public URL for server calls when internal is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PUBLIC_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_URL_INTERNAL", "");
    vi.resetModules();

    const mod = await import("./config");

    expect(mod.SUPABASE_SERVER_URL).toBe(PUBLIC_URL);
    expect(mod.SUPABASE_COOKIE_KEY).toBe("sb-localhost-auth-token");
  });
});
