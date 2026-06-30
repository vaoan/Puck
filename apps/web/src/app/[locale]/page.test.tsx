import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

import { renderWithProviders } from "@/test/render";

describe("HomePage", () => {
  it("renders the home test-id", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });
});
