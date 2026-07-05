import { describe, it, expect, vi, beforeEach } from "vitest";

const exchange = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/shared/infrastructure/supabase/server-client", () => ({
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession: exchange },
  }),
}));

import { GET } from "./route";

describe("oauth callback", () => {
  beforeEach(() => exchange.mockClear());

  it("exchanges the code and redirects to a safe next", async () => {
    const req = new Request(
      "http://localhost:5000/auth/callback?code=abc&next=/en/account",
    );
    const res = await GET(req as never);
    expect(exchange).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toContain("/en/account");
  });

  it("redirects to login when no code is present", async () => {
    const req = new Request("http://localhost:5000/auth/callback");
    const res = await GET(req as never);
    expect(exchange).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/en/login");
  });

  it("rejects an unsafe (external) next and falls back to /en/account", async () => {
    const req = new Request(
      "http://localhost:5000/auth/callback?code=abc&next=//evil.com",
    );
    const res = await GET(req as never);
    expect(res.headers.get("location")).toContain("/en/account");
    expect(res.headers.get("location")).not.toContain("evil.com");
  });
});
