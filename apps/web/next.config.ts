import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(
  "./src/shared/infrastructure/i18n/request.ts",
);

const nextConfig: NextConfig = {
  transpilePackages: ["@puck/ui", "@puck/db", "@puck/auth"],
};

export default withNextIntl(nextConfig);
