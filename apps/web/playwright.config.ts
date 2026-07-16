import { defineConfig, devices } from "@playwright/test";

// The app runs on port 5000 (`next dev -p 5000`). Override with E2E_BASE_URL.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5000";

/**
 * Slice-1 E2E config.
 *
 * External stack, like CandyStore: a **local Supabase** must be running
 * (`pnpm db:start` + `pnpm db:reset`) with `NEXT_PUBLIC_SUPABASE_URL`,
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the
 * environment. Playwright manages the Next app itself via `webServer`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    // Health check on a deterministic 200 page — the bare root redirects and
    // the middleware's session lookup shouldn't gate readiness.
    url: `${BASE_URL}/en/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
