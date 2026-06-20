/**
 * Placeholder for Supabase-generated types.
 *
 * Once the local stack is running, regenerate the real definitions with:
 *   pnpm db:types
 * which runs `supabase gen types typescript --local` and overwrites this file.
 * Until then we expose a permissive type so the package compiles. `any` here
 * makes the Supabase client loosely typed (queries accept and return untyped
 * rows); regenerating replaces this with the strict, table-aware schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- placeholder schema; replaced by `pnpm db:types`
export type Database = any;
