import { describe, expect, it } from "vitest";
import { admin } from "./helpers.js";

describe("set_updated_at()", () => {
  it("exists as a function", async () => {
    const { data, error } = await admin().rpc("set_updated_at_probe");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});
