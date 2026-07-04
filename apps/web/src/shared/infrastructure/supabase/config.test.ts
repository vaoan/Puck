import { describe, it, expect } from "vitest";

import { deriveProjectRef } from "./config";

describe("deriveProjectRef", () => {
  it("extracts the project ref from a supabase url", () => {
    expect(deriveProjectRef("https://abcdxyz.supabase.co")).toBe("abcdxyz");
    expect(deriveProjectRef("http://localhost:54321")).toBe("localhost");
  });
});
