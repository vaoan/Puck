import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithProvider = vi.fn();
vi.mock("@/shared/application/hooks/useAuth", () => ({
  useAuth: () => ({ signInWithProvider, user: null, signOut: vi.fn() }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { SocialLoginButtons } from "./SocialLoginButtons";

describe("SocialLoginButtons", () => {
  beforeEach(() => signInWithProvider.mockClear());

  it("calls signInWithProvider('google', …/auth/callback) on click", async () => {
    render(<SocialLoginButtons />);
    await userEvent.click(screen.getByTestId("login-google"));
    expect(signInWithProvider).toHaveBeenCalledWith(
      "google",
      expect.stringContaining("/auth/callback"),
    );
  });

  it("calls signInWithProvider('discord', …) on click", async () => {
    render(<SocialLoginButtons />);
    await userEvent.click(screen.getByTestId("login-discord"));
    expect(signInWithProvider).toHaveBeenCalledWith(
      "discord",
      expect.stringContaining("/auth/callback"),
    );
  });
});
