import { describe, it, expect } from "vitest";

import { cn } from "./cn";
describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    const isHidden = false;
    expect(cn("text-sm", isHidden && "hidden", "font-bold")).toBe(
      "text-sm font-bold",
    );
  });
});
