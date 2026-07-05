import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";

import { routing } from "@/shared/infrastructure/i18n";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_COOKIE_KEY,
} from "@/shared/infrastructure/supabase/config";
import { needsAuthRedirect } from "@/shared/infrastructure/supabase/middleware-session";

const intl = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const res = intl(request);

  // Refresh the Supabase session, mirroring any updated cookies onto the intl response.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_COOKIE_KEY },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) =>
        toSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options),
        ),
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

export const config = {
  matcher: ["/((?!_next|api|auth/callback|.*\\..*).*)"],
};
