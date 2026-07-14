import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for admin endpoints. Prefers the secret
 * (service-role) key when available so admin queries bypass RLS; falls back
 * to the publishable key, matching what the rest of the app can see.
 */

let cached: SupabaseClient | null | undefined;

export function getAdminSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}
