import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

import { ProfileForm } from "./ProfileForm";

import type { Profile } from "@/features/account/domain/types";

const profile = {
  id: "u1",
  display_name: "Old",
  avatar_url: null,
} as Profile;

describe("ProfileForm", () => {
  it("submits trimmed display_name", async () => {
    const onSubmit = vi.fn();
    render(
      <ProfileForm
        profile={profile}
        onSubmit={onSubmit}
        isPending={false}
        isSuccess={false}
        isError={false}
      />,
    );

    const input = screen.getByTestId("profile-display-name");
    await userEvent.clear(input);
    await userEvent.type(input, "  New Name  ");
    await userEvent.click(screen.getByTestId("profile-save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "New Name" }),
    );
  });

  it("blocks submit and does not call onSubmit for a non-https avatar url", async () => {
    const onSubmit = vi.fn();
    render(
      <ProfileForm
        profile={profile}
        onSubmit={onSubmit}
        isPending={false}
        isSuccess={false}
        isError={false}
      />,
    );

    await userEvent.type(
      screen.getByTestId("profile-avatar-url"),
      "http://insecure.example.com/a.png",
    );
    await userEvent.click(screen.getByTestId("profile-save"));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
