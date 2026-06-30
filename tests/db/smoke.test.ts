import { describe, expect, it } from "vitest";
import { admin } from "./helpers.js";

describe("local supabase", () => {
  it("connects with the service role", async () => {
    const { error } = await admin().from("user_profiles").select("id").limit(1);
    // After Task 3 this table exists; for now we assert connectivity (no network error).
    expect(error?.message ?? "connected").not.toContain("fetch failed");
  });
});
