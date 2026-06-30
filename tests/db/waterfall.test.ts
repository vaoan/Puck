import { describe, expect, it } from "vitest";
import {
  admin,
  createUser,
  makeEvent,
  makeSession,
  userClient,
} from "./helpers.js";

async function can(
  client: Awaited<ReturnType<typeof userClient>>,
  fn: string,
  args: object,
): Promise<boolean> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data as boolean;
}

describe("waterfall helpers", () => {
  it("event owner can edit; event delegate limited to granted keys", async () => {
    const a = admin();
    const owner = await createUser();
    const delegate = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });
    await a.from("event_delegates").insert({
      event_id: eventId,
      user_id: delegate.id,
      permissions: ["event.edit_details"],
      granted_by: owner.id,
    });

    const ownerCli = await userClient(owner.email, owner.password);
    const delCli = await userClient(delegate.email, delegate.password);

    expect(
      await can(ownerCli, "can_edit_event", {
        p_event_id: eventId,
        p_key: "event.cancel",
      }),
    ).toBe(true);
    expect(
      await can(delCli, "can_edit_event", {
        p_event_id: eventId,
        p_key: "event.edit_details",
      }),
    ).toBe(true);
    expect(
      await can(delCli, "can_edit_event", {
        p_event_id: eventId,
        p_key: "event.cancel",
      }),
    ).toBe(false);
  });

  it("event moderator can act on a session below (override)", async () => {
    const a = admin();
    const owner = await createUser();
    const { id: eventId } = await makeEvent(a, { owner_id: owner.id });
    const { id: sessionId } = await makeSession(a, eventId);
    const ownerCli = await userClient(owner.email, owner.password);
    expect(
      await can(ownerCli, "can_act_on_session", {
        p_session_id: sessionId,
        p_key: "session.edit_details",
      }),
    ).toBe(true);
  });
});
