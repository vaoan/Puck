import { describe, expect, it } from "vitest";
import { admin, createUser, makeEvent, userClient } from "./helpers.js";

describe("severe-action RPCs", () => {
  it("cancel_event requires event.cancel", async () => {
    const a = admin();
    const owner = await createUser();
    const other = await createUser();
    const { id } = await makeEvent(a, {
      owner_id: owner.id,
      status: "published",
    });

    const otherCli = await userClient(other.email, other.password);
    const { error: denied } = await otherCli.rpc("cancel_event", {
      p_event_id: id,
    });
    expect(denied?.code).toBe("42501");

    const ownerCli = await userClient(owner.email, owner.password);
    const { error: ok } = await ownerCli.rpc("cancel_event", {
      p_event_id: id,
    });
    expect(ok).toBeNull();

    const { data } = await a
      .from("events")
      .select("status")
      .eq("id", id)
      .single();
    expect(data.status).toBe("canceled");
  });

  it("publish_event requires event.manage_lifecycle", async () => {
    const a = admin();
    const owner = await createUser();
    const other = await createUser();
    const { id } = await makeEvent(a, { owner_id: owner.id });

    const otherCli = await userClient(other.email, other.password);
    const { error: denied } = await otherCli.rpc("publish_event", {
      p_event_id: id,
    });
    expect(denied?.code).toBe("42501");

    const ownerCli = await userClient(owner.email, owner.password);
    const { error: ok } = await ownerCli.rpc("publish_event", {
      p_event_id: id,
    });
    expect(ok).toBeNull();

    const { data } = await a
      .from("events")
      .select("status")
      .eq("id", id)
      .single();
    expect(data.status).toBe("published");
  });

  it("set_event_visibility requires event.manage_visibility", async () => {
    const a = admin();
    const owner = await createUser();
    const other = await createUser();
    const { id } = await makeEvent(a, { owner_id: owner.id });

    const otherCli = await userClient(other.email, other.password);
    const { error: denied } = await otherCli.rpc("set_event_visibility", {
      p_event_id: id,
      p_visibility: "private",
    });
    expect(denied?.code).toBe("42501");

    const ownerCli = await userClient(owner.email, owner.password);
    const { error: ok } = await ownerCli.rpc("set_event_visibility", {
      p_event_id: id,
      p_visibility: "private",
    });
    expect(ok).toBeNull();

    const { data } = await a
      .from("events")
      .select("visibility")
      .eq("id", id)
      .single();
    expect(data.visibility).toBe("private");
  });

  it("broadcast_announcement requires event.broadcast and non-empty title", async () => {
    const a = admin();
    const owner = await createUser();
    const other = await createUser();
    const { id } = await makeEvent(a, { owner_id: owner.id });

    // permission denied for non-owner
    const otherCli = await userClient(other.email, other.password);
    const { error: denied } = await otherCli.rpc("broadcast_announcement", {
      p_event_id: id,
      p_title: "Hello",
      p_body: "World",
    });
    expect(denied?.code).toBe("42501");

    // owner with blank title is rejected
    const ownerCli = await userClient(owner.email, owner.password);
    const { error: noTitle } = await ownerCli.rpc("broadcast_announcement", {
      p_event_id: id,
      p_title: "   ",
      p_body: "World",
    });
    expect(noTitle?.code).toBe("22000");

    // owner with valid title succeeds (stub — no fan-out)
    const { error: ok } = await ownerCli.rpc("broadcast_announcement", {
      p_event_id: id,
      p_title: "Hello",
      p_body: "World",
    });
    expect(ok).toBeNull();
  });
});
