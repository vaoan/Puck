import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Button } from "./button";
describe("Button", () => {
  it("renders children and applies brand variant by default", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-brand");
  });
});
