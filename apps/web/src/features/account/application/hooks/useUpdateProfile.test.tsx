import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateProfile = vi.fn();

vi.mock("@/shared/application/hooks/useSupabase", () => ({
  useSupabase: () => ({}),
}));
vi.mock("@/features/account/infrastructure/profile-queries", () => ({
  fetchProfile: vi.fn(),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

import { useUpdateProfile } from "./useUpdateProfile";

/** A fresh QueryClient per test — a shared cache would leak between tests. */
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useUpdateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfile.mockResolvedValue({
      id: "u1",
      display_name: "B",
      avatar_url: null,
    });
  });

  it("calls updateProfile with the submitted values", async () => {
    const { result } = renderHook(() => useUpdateProfile("u1"), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ display_name: "B", avatar_url: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateProfile).toHaveBeenCalledWith({}, "u1", {
      display_name: "B",
      avatar_url: null,
    });
  });

  it("surfaces a failed update as an error", async () => {
    updateProfile.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useUpdateProfile("u1"), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ display_name: "B", avatar_url: null });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
