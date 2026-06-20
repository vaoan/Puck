import { describe, expect, it } from "vitest";

import type { PuckSupabaseClient } from "../client.js";

import { createFollowRepository } from "./supabase-repositories.js";

/** Minimal fake of the `from(...).select(...).eq(...)` chain the repo awaits. */
function fakeClient(response: { data: unknown; error: unknown }): {
  client: PuckSupabaseClient;
  eqArgs: { column: string; value: unknown }[];
} {
  const eqArgs: { column: string; value: unknown }[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          eqArgs.push({ column, value });
          return Promise.resolve(response);
        },
      }),
    }),
  } as unknown as PuckSupabaseClient;
  return { client, eqArgs };
}

describe("createFollowRepository", () => {
  it("maps snake_case rows to camelCase domain follows", async () => {
    const { client, eqArgs } = fakeClient({
      data: [
        {
          id: "f1",
          user_id: "u1",
          event_id: "e1",
          muted_types: ["delayed"],
          created_at: "2026-06-19T00:00:00Z",
        },
      ],
      error: null,
    });

    const follows =
      await createFollowRepository(client).listFollowersForEvent("e1");

    expect(eqArgs).toEqual([{ column: "event_id", value: "e1" }]);
    expect(follows).toEqual([
      {
        id: "f1",
        userId: "u1",
        eventId: "e1",
        mutedTypes: ["delayed"],
        createdAt: "2026-06-19T00:00:00Z",
      },
    ]);
  });

  it("throws when the query returns an error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });

    await expect(
      createFollowRepository(client).listFollowersForEvent("e1"),
    ).rejects.toThrow("boom");
  });
});
