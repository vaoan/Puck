import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "@/shared/infrastructure/i18n";
import {
  isExcluded,
  resolveLocale,
} from "@/shared/infrastructure/routing/proxy-routing";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_KEY,
} from "@/shared/infrastructure/supabase/config";
import { needsAuthRedirect } from "@/shared/infrastructure/supabase/middleware-session";

const intl = createIntlMiddleware(routing);

/** Supabase returns 401 for "no/expired session" — an expected, non-loggable state. */
const HTTP_UNAUTHORIZED = 401;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isExcluded(pathname)) return NextResponse.next();

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
  const { data, error } = await supabase.auth.getUser();

  // Fail closed, but keep the cause visible: a transient Supabase outage is
  // indistinguishable from "signed out" without this.
  if (error && error.status !== HTTP_UNAUTHORIZED) {
    console.error("[proxy] Supabase getUser failed:", error.message);
  }

  if (needsAuthRedirect(pathname, !!data.user)) {
    const url = new URL(`/${resolveLocale(pathname)}/login`, request.url);
    url.searchParams.set("returnTo", pathname);
    const redirectRes = NextResponse.redirect(url);
    // Carry over cookies written during getUser() — notably the sign-out
    // cookie removals when a refresh token has expired. A bare
    // NextResponse.redirect() would drop them and strand a dead session cookie.
    for (const cookie of res.cookies.getAll()) redirectRes.cookies.set(cookie);
    return redirectRes;
  }

  return res;
}
