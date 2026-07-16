import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn<() => Promise<void>>();
const push = vi.fn();

vi.mock("@/shared/application/hooks/useAuth", () => ({
  useAuth: () => ({ signOut }),
}));
vi.mock("@/shared/infrastructure/i18n", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (k: string) => `${ns}.${k}`,
}));

import { SignOutButton } from "./SignOutButton";

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue();
  });

  it("signs out then redirects to /login", async () => {
    render(<SignOutButton />);

    await userEvent.click(screen.getByTestId("sign-out"));

    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("surfaces an error and stays put when sign-out fails", async () => {
    signOut.mockRejectedValue(new Error("network down"));
    render(<SignOutButton />);

    await userEvent.click(screen.getByTestId("sign-out"));

    // Without handling, the rejection is swallowed and the button just looks
    // dead — the user gets no signal at all.
    expect(await screen.findByTestId("sign-out-error")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores repeat clicks while signing out", async () => {
    let release: (() => void) | undefined;
    signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    render(<SignOutButton />);

    const button = screen.getByTestId("sign-out");
    await userEvent.click(button);
    await userEvent.click(button);

    expect(signOut).toHaveBeenCalledTimes(1);
    release?.();
  });
});
