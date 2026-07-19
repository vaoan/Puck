import { afterEach, describe, it, expect } from "vitest";
import { collectSecrets, resolveEnv } from "./load-env.mjs";

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

describe("collectSecrets (CI)", () => {
  const saved = { CI: process.env.CI, TOK: process.env.MY_TOKEN };

  afterEach(() => {
    process.env.CI = saved.CI;
    if (saved.TOK === undefined) delete process.env.MY_TOKEN;
    else process.env.MY_TOKEN = saved.TOK;
  });

  it("collects referenced secrets from process.env in CI", () => {
    process.env.CI = "true";
    process.env.MY_TOKEN = "xyz";
    expect(collectSecrets("K=$secret:MY_TOKEN\n", "/nonexistent")).toEqual({
      MY_TOKEN: "xyz",
    });
  });

  it("resolves an absent referenced secret to an empty string in CI", () => {
    process.env.CI = "true";
    delete process.env.MY_TOKEN;
    // The whole point: no .secrets file and a missing var must NOT throw.
    expect(collectSecrets("K=$secret:MY_TOKEN\n", "/nonexistent")).toEqual({
      MY_TOKEN: "",
    });
  });
});
