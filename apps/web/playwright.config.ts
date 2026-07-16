import { defineConfig, devices } from "@playwright/test";

// The app is served by scripts/e2e.mjs — either the puck-ci container
// (APPS_MODE=docker, http://localhost:5050) or `pnpm dev` (http://localhost:5000).
const BASE_URL =
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.E2E_BASE_URL ??
  "http://localhost:5000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No webServer — the app lifecycle is owned by scripts/e2e.mjs.
});
