import { describe, expect, it } from "vitest";
import { admin, createUser, grantGlobal } from "./helpers.js";

async function hasPerm(userId: string, key: string): Promise<boolean> {
  const { data, error } = await admin().rpc("has_global_permission", {
    p_user_id: userId,
    p_key: key,
  });
  if (error) throw error;
  return data as boolean;
}

describe("permission catalog + has_global_permission", () => {
  it("seeds the 28-key catalog", async () => {
    const { count } = await admin()
      .from("permissions")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(28);
  });

  it("returns true only for granted, non-expired, non-denied keys", async () => {
    const u = await createUser();
    expect(await hasPerm(u.id, "events.create")).toBe(false);
    await grantGlobal(u.id, "events.create");
    expect(await hasPerm(u.id, "events.create")).toBe(true);
  });

  it("an explicit deny overrides a grant", async () => {
    const u = await createUser();
    await grantGlobal(u.id, "platform.admin");
    const { data: perm } = await admin()
      .from("permissions")
      .select("id")
      .eq("key", "platform.admin")
      .single();
    await admin().from("user_permissions").insert({
      user_id: u.id,
      permission_id: perm.id,
      mode: "deny",
      granted_by: u.id,
    });
    expect(await hasPerm(u.id, "platform.admin")).toBe(false);
  });
});
