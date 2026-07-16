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

  it("shows a translated error for a non-https avatar url", async () => {
    render(
      <ProfileForm
        profile={profile}
        onSubmit={vi.fn()}
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

    // useTranslations is mocked to echo its key, so a translated message
    // renders the key itself — raw zod English would not match.
    expect(
      await screen.findByTestId("profile-avatar-url-error"),
    ).toHaveTextContent("errors.avatarUrlInvalid");
  });

  it("stops showing the saved label once the user edits again", async () => {
    const props = {
      profile,
      onSubmit: vi.fn(),
      isPending: false,
      isError: false,
    };
    const { rerender } = render(<ProfileForm {...props} isSuccess={false} />);

    rerender(<ProfileForm {...props} isSuccess />);
    expect(screen.getByTestId("profile-save")).toHaveTextContent(/^saved$/);

    // react-query keeps isSuccess true indefinitely; the label must still
    // return to "save" when the form no longer matches what was persisted.
    await userEvent.type(screen.getByTestId("profile-display-name"), "x");
    expect(screen.getByTestId("profile-save")).toHaveTextContent(/^save$/);
  });

  it("shows an error instead of failing silently for an over-long display_name", async () => {
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
    await userEvent.type(input, "x".repeat(101));
    await userEvent.click(screen.getByTestId("profile-save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId("profile-display-name-error"),
    ).toHaveTextContent("errors.displayNameTooLong");
  });
});
