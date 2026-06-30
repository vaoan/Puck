import { describe, expect, it } from "vitest";

import { matchesPermissions } from "./permissions.js";

describe("matchesPermissions", () => {
  const granted = new Set(["event.edit_details", "event_content.create"]);
  it("matches a single key", () => {
    expect(matchesPermissions(granted, "event.edit_details")).toBe(true);
    expect(matchesPermissions(granted, "event.cancel")).toBe(false);
  });
  it("supports all vs any", () => {
    expect(
      matchesPermissions(
        granted,
        ["event.edit_details", "event.cancel"],
        "all",
      ),
    ).toBe(false);
    expect(
      matchesPermissions(
        granted,
        ["event.edit_details", "event.cancel"],
        "any",
      ),
    ).toBe(true);
  });
});
