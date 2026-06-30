import { defineConfig } from "vitest/config";

/**
 * Root Vitest configuration.
 *
 * Discovers and runs:
 *   - scripts/**\/*.test.mjs  — the env-resolver tests (load-env.test.mjs) now
 *   - workspace package tests once apps/* / packages/* are built (via turbo)
 *
 * Run directly:   pnpm exec vitest run
 * Watch mode:     pnpm exec vitest
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.mjs"],
    globals: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
