import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";

const fetchProfile = vi
  .fn()
  .mockResolvedValue({ id: "u1", display_name: "A", avatar_url: null });
const updateProfile = vi
  .fn()
  .mockResolvedValue({ id: "u1", display_name: "B", avatar_url: null });

vi.mock("@/shared/application/hooks/useSupabase", () => ({
  useSupabase: () => ({}),
}));
vi.mock("@/features/account/infrastructure/profile-queries", () => ({
  fetchProfile: (...args: unknown[]) => fetchProfile(...args),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

import { useProfile } from "./useProfile";
import { useUpdateProfile } from "./useUpdateProfile";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useProfile", () => {
  it("loads the profile for a user id", async () => {
    const { result } = renderHook(() => useProfile("u1"), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("u1"));
    expect(fetchProfile).toHaveBeenCalledWith({}, "u1");
  });

  it("is disabled when no user id is provided", () => {
    const { result } = renderHook(() => useProfile(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useUpdateProfile", () => {
  it("calls updateProfile with the submitted values", async () => {
    const { result } = renderHook(() => useUpdateProfile("u1"), { wrapper });
    result.current.mutate({ display_name: "B", avatar_url: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateProfile).toHaveBeenCalledWith({}, "u1", {
      display_name: "B",
      avatar_url: null,
    });
  });
});
