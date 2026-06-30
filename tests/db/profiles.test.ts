import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { admin, createUser, userClient } from "./helpers.js";

function anonClient() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false } },
  );
}

describe("user_profiles", () => {
  it("auto-creates a profile when an auth user is created", async () => {
    const u = await createUser();
    const { data, error } = await admin()
      .from("user_profiles")
      .select("id,email")
      .eq("id", u.id)
      .single();
    expect(error).toBeNull();
    expect(data.email).toBe(u.email);
  });

  it("is readable by anyone but only self-updatable", async () => {
    const u = await createUser();
    const other = await createUser();
    const cli = await userClient(u.email, u.password);

    const { error: readErr } = await cli
      .from("user_profiles")
      .select("id")
      .eq("id", other.id)
      .single();
    expect(readErr).toBeNull(); // read all

    // Under PostgREST + RLS, a non-owner UPDATE is a silent 0-row no-op: the
    // USING (auth.uid() = id) policy filters the row out and no error is returned.
    // Prove the security property by verifying via admin that the row was not mutated.

    // Set a known sentinel on the target profile so the invariant is explicit
    // and cannot pass vacuously if display_name happened to be null initially.
    await admin()
      .from("user_profiles")
      .update({ display_name: "original-name" })
      .eq("id", other.id);

    await cli
      .from("user_profiles")
      .update({ display_name: "hacker" })
      .eq("id", other.id);

    const { data: check, error: checkErr } = await admin()
      .from("user_profiles")
      .select("display_name")
      .eq("id", other.id)
      .single();
    expect(checkErr).toBeNull(); // admin read must succeed
    expect(check).not.toBeNull(); // the target profile must exist
    expect(check!.display_name).toBe("original-name"); // sentinel survived — cannot update others
  });

  it("anon cannot read PII columns (email/provider) but can read public profile columns", async () => {
    const u = await createUser();
    const anon = anonClient();

    // PII column is denied at the column-privilege layer (before RLS) — Postgres
    // surfaces 42501 "permission denied for table user_profiles".
    const { error: emailErr } = await anon
      .from("user_profiles")
      .select("email")
      .eq("id", u.id);
    expect(emailErr).not.toBeNull();
    expect(emailErr!.code).toBe("42501");

    const { error: providerErr } = await anon
      .from("user_profiles")
      .select("provider")
      .eq("id", u.id);
    expect(providerErr).not.toBeNull();
    expect(providerErr!.code).toBe("42501");

    // Non-PII columns remain publicly readable for display.
    const { data, error } = await anon
      .from("user_profiles")
      .select("id,display_name,avatar_url")
      .eq("id", u.id);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data![0]!.id).toBe(u.id);
  });

  it("an authenticated non-owner also cannot read another user's email", async () => {
    const target = await createUser();
    const viewer = await createUser();
    const cli = await userClient(viewer.email, viewer.password);

    const { error: emailErr } = await cli
      .from("user_profiles")
      .select("email")
      .eq("id", target.id);
    expect(emailErr).not.toBeNull();
    expect(emailErr!.code).toBe("42501");

    // ...but the non-PII display columns are still readable.
    const { error: okErr } = await cli
      .from("user_profiles")
      .select("id,display_name")
      .eq("id", target.id);
    expect(okErr).toBeNull();
  });
});
