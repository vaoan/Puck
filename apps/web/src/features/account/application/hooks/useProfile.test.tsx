import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchProfile = vi.fn();

vi.mock("@/shared/application/hooks/useSupabase", () => ({
  useSupabase: () => ({}),
}));
vi.mock("@/features/account/infrastructure/profile-queries", () => ({
  fetchProfile: (...args: unknown[]) => fetchProfile(...args),
  updateProfile: vi.fn(),
}));

import { useProfile } from "./useProfile";

/** A fresh QueryClient per test — a shared cache would leak between tests. */
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProfile.mockResolvedValue({
      id: "u1",
      display_name: "A",
      avatar_url: null,
    });
  });

  it("loads the profile for a user id", async () => {
    const { result } = renderHook(() => useProfile("u1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data?.id).toBe("u1"));
    expect(fetchProfile).toHaveBeenCalledWith({}, "u1");
  });

  it("is disabled when no user id is provided", () => {
    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchProfile).not.toHaveBeenCalled();
  });
});
