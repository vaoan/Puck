import { routing } from "@/shared/infrastructure/i18n/routing";
import { isProtectedPath } from "@/shared/infrastructure/supabase/middleware-session";

type Locale = (typeof routing.locales)[number];

/**
 * Paths the proxy skips entirely — Next internals, the API, the OAuth
 * callback, and static files (including locale-prefixed asset paths such as
 * `/en/_next/*`). If next-intl runs on these it locale-prefixes them and
 * breaks asset loading.
 *
 * A protected route is never skipped: the extension check would otherwise let
 * a path segment containing a dot (an event slug like `/en/account/fest-v1.0`)
 * bypass authentication.
 */
export function isExcluded(pathname: string): boolean {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback")
  ) {
    return true;
  }
  const segments = pathname.split("/"); // ["", "en", "_next", …]
  if (segments[2] === "_next" || segments[2] === "api") return true;
  if (isProtectedPath(pathname)) return false;
  return (segments.at(-1) ?? "").includes("."); // any file with an extension
}

/**
 * The locale a path is prefixed with, falling back to the default when the
 * path is unprefixed or names an unsupported locale. Guards against building
 * a redirect to a bogus locale (e.g. `/account/login` from `/account`), which
 * would redirect to itself.
 */
export function resolveLocale(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return routing.locales.includes(segment as Locale)
    ? (segment as Locale)
    : routing.defaultLocale;
}
