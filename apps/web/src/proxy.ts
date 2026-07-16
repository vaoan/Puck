import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "@/shared/infrastructure/i18n";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_KEY,
} from "@/shared/infrastructure/supabase/config";
import { needsAuthRedirect } from "@/shared/infrastructure/supabase/middleware-session";

const intl = createIntlMiddleware(routing);

// Skip Next internals, the API, the OAuth callback, and any file with an
// extension — including locale-prefixed asset paths (e.g. /en/_next/*). If
// next-intl runs on these it locale-prefixes them and breaks asset loading.
function isExcluded(pathname: string): boolean {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback")
  ) {
    return true;
  }
  const segments = pathname.split("/"); // ["", "en", "_next", …]
  if (segments[2] === "_next" || segments[2] === "api") return true;
  return (segments.at(-1) ?? "").includes("."); // any file with an extension
}

export async function proxy(request: NextRequest) {
  if (isExcluded(request.nextUrl.pathname)) return NextResponse.next();

  const res = intl(request);

  // Refresh the Supabase session, mirroring any updated cookies onto the intl response.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet)
          res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (needsAuthRedirect(request.nextUrl.pathname, !!data.user)) {
    const locale =
      request.nextUrl.pathname.split("/")[1] || routing.defaultLocale;
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return res;
}
