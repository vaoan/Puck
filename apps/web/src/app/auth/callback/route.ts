import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/shared/infrastructure/supabase/server-client";

/** Only allow same-origin, single-slash paths to prevent open-redirects. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/en/account";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/en/login", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/en/login?error=auth", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
