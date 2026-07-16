import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(
  "./src/shared/infrastructure/i18n/request.ts",
);

const nextConfig: NextConfig = {
  transpilePackages: ["@puck/ui", "@puck/db", "@puck/auth"],
  // Standalone output for the Docker image. outputFileTracingRoot points at the
  // monorepo root so the workspace packages (@puck/*) are traced into the bundle.
  output: process.env.STANDALONE === "true" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default withNextIntl(nextConfig);
