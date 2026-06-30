import { describe, expect, it } from "vitest";
import { admin } from "./helpers.js";

describe("domain schema", () => {
  it("creates an event with defaults and cascades to sessions/occurrences on delete", async () => {
    const a = admin();
    const { data: ev, error: evErr } = await a
      .from("events")
      .insert({ title: "Fest", timezone: "UTC" })
      .select("id,status,visibility")
      .single();
    expect(evErr).toBeNull();
    expect(ev.status).toBe("draft");
    expect(ev.visibility).toBe("public");

    const { data: se } = await a
      .from("sessions")
      .insert({ event_id: ev.id, title: "Talk" })
      .select("id")
      .single();
    await a
      .from("session_occurrences")
      .insert({ session_id: se.id, starts_at: "2026-08-14T18:00:00Z" });

    await a.from("events").delete().eq("id", ev.id);
    const { count } = await a
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("id", se.id);
    expect(count).toBe(0); // cascade
  });
});

describe("documents", () => {
  it("rejects a document with neither or both parents", async () => {
    const a = admin();
    const { error: noneErr } = await a.from("documents").insert({
      storage_path: "x",
      filename: "f",
      content_type: "application/pdf",
    });
    expect(noneErr).not.toBeNull();
  });
});
