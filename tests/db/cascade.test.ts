import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent, makeSession } from "./helpers.js";

describe("orphan cascade", () => {
  it("revoking a session owner orphans their sessions and drops session delegates", async () => {
    const a = admin();
    const owner = await createUser();
    const sowner = await createUser();
    const sdelegate = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });
    await a
      .from("event_session_owners")
      .insert({ event_id: eventId, user_id: sowner.id, granted_by: owner.id });
    const { id: sessionId } = await makeSession(a, eventId, {
      owner_id: sowner.id,
    });
    await a.from("session_delegates").insert({
      session_id: sessionId,
      user_id: sdelegate.id,
      permissions: ["session.edit_details"],
      granted_by: sowner.id,
    });

    await a
      .from("event_session_owners")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", sowner.id);

    const { data: sess } = await a
      .from("sessions")
      .select("owner_id")
      .eq("id", sessionId)
      .single();
    expect(sess.owner_id).toBeNull(); // orphaned

    const { count } = await a
      .from("session_delegates")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);
    expect(count).toBe(0); // delegates dropped
  });
});
