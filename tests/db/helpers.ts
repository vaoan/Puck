import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (): string => process.env.SUPABASE_URL as string;
const anon = (): string => process.env.SUPABASE_ANON_KEY as string;
const service = (): string => process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const admin = (): SupabaseClient =>
  createClient(url(), service(), { auth: { persistSession: false } });

let seq = 0;
export async function createUser(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  seq += 1;
  const email = `u${Date.now()}_${seq}@test.puck`;
  const password = "Test-pass-123!";
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

export async function userClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const c = createClient(url(), anon(), { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

export async function grantGlobal(userId: string, key: string): Promise<void> {
  const a = admin();
  const { data: perm, error } = await a
    .from("permissions")
    .select("id")
    .eq("key", key)
    .single();
  if (error) throw error;
  const { error: insErr } = await a.from("user_permissions").insert({
    user_id: userId,
    permission_id: perm.id,
    mode: "grant",
    granted_by: userId,
  });
  if (insErr) throw insErr;
}

export async function makeEvent(
  owner: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await owner
    .from("events")
    .insert({ title: "Test Event", timezone: "UTC", ...overrides })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function makeSession(
  client: SupabaseClient,
  eventId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("sessions")
    .insert({ event_id: eventId, title: "Test Session", ...overrides })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}
