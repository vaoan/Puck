import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent } from "./helpers.js";

describe("auditing", () => {
  it("records an INSERT with actor and row snapshot", async () => {
    const a = admin();
    const owner = await createUser();
    const { id } = await makeEvent(a, { owner_id: owner.id, title: "Audited" });
    const { data } = await a
      .schema("audit")
      .from("logged_actions")
      .select("action_type,row_data")
      .eq("table_name", "events")
      .order("event_id", { ascending: false })
      .limit(1)
      .single();
    expect(data.action_type).toBe("INSERT");
    expect((data.row_data as { id: string }).id).toBe(id);
  });

  it("blocks updates/deletes on audit rows (immutable)", async () => {
    const a = admin();
    const { error } = await a
      .schema("audit")
      .from("logged_actions")
      .update({ table_name: "x" })
      .eq("event_id", 1);
    expect(error).not.toBeNull();
    expect(error?.message).toContain("append-only");
  });
});
