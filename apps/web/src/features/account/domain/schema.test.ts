import { describe, it, expect } from "vitest";

import { profileFormSchema } from "./schema";

describe("profileFormSchema", () => {
  it("trims display_name and keeps the value", () => {
    const out = profileFormSchema.parse({ display_name: "  Puck  " });
    expect(out.display_name).toBe("Puck");
  });

  it("coerces an empty/whitespace display_name to null", () => {
    const out = profileFormSchema.parse({ display_name: "   " });
    expect(out.display_name).toBeNull();
  });

  it("coerces an empty avatar_url to null", () => {
    const out = profileFormSchema.parse({ avatar_url: "" });
    expect(out.avatar_url).toBeNull();
  });

  it("accepts an https avatar_url", () => {
    const out = profileFormSchema.parse({
      avatar_url: "https://cdn.example.com/a.png",
    });
    expect(out.avatar_url).toBe("https://cdn.example.com/a.png");
  });

  it("rejects a non-https avatar_url", () => {
    expect(() =>
      profileFormSchema.parse({ avatar_url: "http://cdn.example.com/a.png" }),
    ).toThrow();
  });

  it("rejects a display_name longer than 100 chars", () => {
    expect(() =>
      profileFormSchema.parse({ display_name: "x".repeat(101) }),
    ).toThrow();
  });
});
