/** Route prefixes (locale-stripped) that require an authenticated session — the `(app)` group. */
const PROTECTED = ["/account"];

/**
 * Whether a route requires a session, independent of whether one exists.
 * Matches with or without a locale prefix, so an unprefixed `/account` is
 * still recognised as protected.
 */
export function isProtectedPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return PROTECTED.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(`${p}/`),
  );
}

export function needsAuthRedirect(
  pathname: string,
  hasSession: boolean,
): boolean {
  if (hasSession) return false;
  return isProtectedPath(pathname);
}
