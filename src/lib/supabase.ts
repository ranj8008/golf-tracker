import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The publishable key is meant to be public: it can only do what the database's
// row-level security allows (see supabase/setup.sql), which is nothing until you're
// signed in, and then only your own rows.
//
// Also accepts the names Vercel's Supabase integration and Supabase's own guides use.
// Each name is written out in full: Next.js only builds in variables named literally.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();
export const configured = !!SUPABASE_URL && !!SUPABASE_KEY;

let client: SupabaseClient | null = null;

// Browser only. The sign-in is kept on this phone until you sign out.
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
