import { describe, expect, it, beforeEach } from "vitest";

import { loadEnv, resetEnvCache } from "./env.js";

const VALID: NodeJS.ProcessEnv = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

describe("loadEnv", () => {
  beforeEach(() => resetEnvCache());

  it("applies defaults for optional values", () => {
    const env = loadEnv(VALID);
    expect(env.NODE_ENV).toBe("development");
    expect(env.API_PORT).toBe(5200);
    expect(env.TELEGRAM_MODE).toBe("polling");
    expect(env.EMAIL_PROVIDER).toBe("console");
  });

  it("coerces numeric ports from strings", () => {
    const env = loadEnv({ ...VALID, API_PORT: "9000" });
    expect(env.API_PORT).toBe(9000);
  });

  it("throws a descriptive error when required config is missing", () => {
    expect(() => loadEnv({})).toThrowError(/SUPABASE_URL/);
  });
});
