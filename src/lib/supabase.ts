import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The golf tracker's Supabase project. The publishable key is meant to be public:
// it can only do what the database's row-level security allows (see
// supabase/setup.sql), which is nothing until you're signed in, and then only your
// own rows. Never put the secret or service_role key here.
export const SUPABASE_URL = "https://jwpjpijarnitlbtzthxm.supabase.co";
export const SUPABASE_KEY = "sb_publishable_aQmhuR9SWBb1cDLXnOX3gg_0zD43asn";
export const configured = !!SUPABASE_URL && !!SUPABASE_KEY;

let client: SupabaseClient | null = null;

// Browser only. The sign-in is kept on this phone until you sign out.
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
