import { describe, expect, it } from "vitest";
import { admin, makeEvent, makeSession } from "./helpers.js";

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
  it("rejects a document with neither parent (CHECK violation)", async () => {
    const a = admin();
    const { error } = await a.from("documents").insert({
      storage_path: "docs/neither.pdf",
      filename: "neither.pdf",
      content_type: "application/pdf",
    });
    expect(error?.code).toBe("23514"); // Postgres check_violation
  });

  it("rejects a document with both parents (CHECK violation)", async () => {
    const a = admin();
    const { id: eventId } = await makeEvent(a);
    const { id: sessionId } = await makeSession(a, eventId);
    const { error } = await a.from("documents").insert({
      storage_path: "docs/both.pdf",
      filename: "both.pdf",
      content_type: "application/pdf",
      event_id: eventId,
      session_id: sessionId,
    });
    expect(error?.code).toBe("23514"); // Postgres check_violation
    await a.from("events").delete().eq("id", eventId);
  });

  it("accepts a document with exactly one parent (event_id only)", async () => {
    const a = admin();
    const { id: eventId } = await makeEvent(a);
    const { data, error } = await a
      .from("documents")
      .insert({
        storage_path: "docs/valid.pdf",
        filename: "valid.pdf",
        event_id: eventId,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    await a.from("events").delete().eq("id", eventId);
  });
});
