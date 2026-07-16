import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

const signOut = vi.fn(async () => {});
const push = vi.fn();

vi.mock("@/shared/application/hooks/useAuth", () => ({
  useAuth: () => ({ signOut }),
}));
vi.mock("@/shared/infrastructure/i18n", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

import { SignOutButton } from "./SignOutButton";

describe("SignOutButton", () => {
  it("signs out then redirects to /login", async () => {
    render(<SignOutButton />);

    await userEvent.click(screen.getByTestId("sign-out"));

    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
