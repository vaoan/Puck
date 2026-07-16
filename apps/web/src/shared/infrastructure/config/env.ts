import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_URL_INTERNAL: z.string().url().optional(),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // Empty string (unset in the shell) must read as "not provided", not fail .url().
  SUPABASE_URL_INTERNAL: process.env.SUPABASE_URL_INTERNAL || undefined,
});

export const isProduction = process.env.NODE_ENV === "production";
