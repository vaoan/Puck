import { describe, it, expect } from "vitest";
import { resolveEnv } from "./load-env.mjs";

describe("resolveEnv", () => {
  it("substitutes $secret:KEY with the secret value", () => {
    const env =
      "SUPABASE_URL=https://x\nSERVICE_KEY=$secret:PROD_SERVICE_KEY\n";
    const secrets = { PROD_SERVICE_KEY: "abc123" };
    expect(resolveEnv(env, secrets)).toMatchObject({
      SUPABASE_URL: "https://x",
      SERVICE_KEY: "abc123",
    });
  });

  it("throws when a referenced secret is missing", () => {
    expect(() => resolveEnv("K=$secret:MISSING\n", {})).toThrow(/MISSING/);
  });

  it("leaves plain values untouched and ignores blank/comment lines", () => {
    const env = "# comment\n\nFOO=bar\n";
    expect(resolveEnv(env, {})).toEqual({ FOO: "bar" });
  });
});
