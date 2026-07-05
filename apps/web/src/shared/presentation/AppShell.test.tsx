import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/shared/infrastructure/i18n", () => ({
  Link: (props: Record<string, unknown>) => <a {...props} />,
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the nav and its children", () => {
    render(
      <AppShell>
        <div data-testid="content" />
      </AppShell>,
    );
    expect(screen.getByTestId("app-nav")).toBeInTheDocument();
    expect(screen.getByTestId("nav-account")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
