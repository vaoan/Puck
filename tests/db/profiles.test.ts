import { describe, expect, it } from "vitest";
import { admin, createUser, userClient } from "./helpers.js";

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
    await cli
      .from("user_profiles")
      .update({ display_name: "hacker" })
      .eq("id", other.id);

    const { data: check } = await admin()
      .from("user_profiles")
      .select("display_name")
      .eq("id", other.id)
      .single();
    expect(check?.display_name).not.toBe("hacker"); // cannot update others
  });
});
