import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createUser,
  makeEvent,
  makeSession,
  userClient,
} from "./helpers.js";

// One event with: owner, a Designer (content only), a Communications mgr (broadcast only).
let eventId: string;
let designer: Awaited<ReturnType<typeof userClient>>;

beforeAll(async () => {
  const a = admin();
  const owner = await createUser();
  const designerU = await createUser();
  const { id: eId } = await makeEvent(a, { owner_id: owner.id });
  // Session is created for FK integrity; its ID is not used in the current test matrix.
  await makeSession(a, eId, { owner_id: owner.id });
  eventId = eId;
  await a.from("event_delegates").insert({
    event_id: eId,
    user_id: designerU.id,
    permissions: [
      "event_content.create",
      "event_content.update",
      "event_content.delete",
    ],
    granted_by: owner.id,
  });
  designer = await userClient(designerU.email, designerU.password);
});

describe("RLS permission matrix", () => {
  it("Designer can insert event documents", async () => {
    const { error } = await designer.from("documents").insert({
      event_id: eventId,
      storage_path: "p",
      filename: "flyer.pdf",
    });
    expect(error).toBeNull();
  });

  it("Designer cannot edit event details", async () => {
    // Set a known sentinel via admin so the assertion cannot pass vacuously.
    await admin()
      .from("events")
      .update({ title: "pre-hijack" })
      .eq("id", eventId);

    // Designer attempts the edit.  Under PostgREST + RLS the USING clause on the
    // events_update policy excludes the row (designer lacks event.edit_details).
    // PostgreSQL returns 0 rows affected and NO error — so checking `error` would
    // be vacuous.  Instead we read back via admin and prove the title is unchanged.
    await designer
      .from("events")
      .update({ title: "hijacked" })
      .eq("id", eventId);

    const { data, error: readErr } = await admin()
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();
    expect(readErr).toBeNull(); // admin read must succeed
    expect(data).not.toBeNull(); // row must exist
    expect(data!.title).toBe("pre-hijack"); // sentinel unchanged — designer was denied
  });

  it("Anonymous cannot read a draft event", async () => {
    const anonCli = await (
      await import("@supabase/supabase-js")
    ).createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data } = await anonCli
      .from("events")
      .select("id")
      .eq("id", eventId);
    expect(data).toEqual([]);
  });
});
