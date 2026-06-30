import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent } from "./helpers.js";

describe("delegation tables", () => {
  it("stores a permissions array and is unique per (event,user)", async () => {
    const a = admin();
    const owner = await createUser();
    const delegate = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });

    const row = {
      event_id: eventId,
      user_id: delegate.id,
      permissions: ["event.edit_details", "event.broadcast"],
      granted_by: owner.id,
    };
    const { error } = await a.from("event_delegates").insert(row);
    expect(error).toBeNull(); // valid insert must succeed (genuine RED before table exists)

    const { error: dupErr } = await a.from("event_delegates").insert(row);
    expect(dupErr).not.toBeNull(); // unique(event_id,user_id) violated
    expect(dupErr?.code).toBe("23505"); // Postgres unique_violation
  });
});
