/** Route prefixes (locale-stripped) that require an authenticated session — the `(app)` group. */
const PROTECTED = ["/account"];

export function needsAuthRedirect(
  pathname: string,
  hasSession: boolean,
): boolean {
  if (hasSession) return false;
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return PROTECTED.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(`${p}/`),
  );
}
