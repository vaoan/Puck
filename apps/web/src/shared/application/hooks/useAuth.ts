"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { useSupabase } from "./useSupabase";

export type OAuthProvider = "google" | "discord";

export function useAuth() {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signInWithProvider(
    provider: OAuthProvider,
    redirectTo?: string,
  ) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo ?? `${globalThis.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { user, signInWithProvider, signOut };
}
