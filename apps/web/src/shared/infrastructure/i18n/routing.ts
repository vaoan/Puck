import { defineRouting } from "next-intl/routing";

/**
 * Locale routing definition. Kept apart from `createNavigation` (see
 * `index.ts`) so non-React consumers — the proxy and its pure routing
 * helpers — can read locales without pulling in `next/navigation`.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
});
