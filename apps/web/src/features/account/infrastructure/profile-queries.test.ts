import { describe, it, expect, vi } from "vitest";

import {
  fetchProfile,
  updateProfile,
  PROFILE_COLUMNS,
} from "./profile-queries";

function fakeSupabase(row: unknown) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  // fetch chain: from().select().eq().single()
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ single })) }));
  // update chain: from().update().eq().select().single()
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
  }));
  const from = vi.fn(() => ({ select, update }));
  return { client: { from } as never, from, select, update };
}

describe("PROFILE_COLUMNS", () => {
  it("never exposes PII columns", () => {
    expect(PROFILE_COLUMNS).not.toContain("email");
    expect(PROFILE_COLUMNS).not.toContain("provider");
  });
});

describe("fetchProfile", () => {
  it("selects ONLY the non-PII columns from user_profiles", async () => {
    const { client, from, select } = fakeSupabase({
      id: "u1",
      display_name: "A",
    });

    const out = await fetchProfile(client, "u1");

    expect(from).toHaveBeenCalledWith("user_profiles");
    expect(select).toHaveBeenCalledWith(PROFILE_COLUMNS);
    expect(out.id).toBe("u1");
  });

  it("throws when supabase returns an error", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("boom") });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) } as never;

    await expect(fetchProfile(client, "u1")).rejects.toThrow("boom");
  });
});

describe("updateProfile", () => {
  it("updates and returns the column-scoped row", async () => {
    const { client, from, update } = fakeSupabase({
      id: "u1",
      display_name: "New",
    });

    const out = await updateProfile(client, "u1", {
      display_name: "New",
      avatar_url: null,
    });

    expect(from).toHaveBeenCalledWith("user_profiles");
    expect(update).toHaveBeenCalledWith({
      display_name: "New",
      avatar_url: null,
    });
    expect(out.display_name).toBe("New");
  });
});
