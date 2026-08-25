import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv, getSupabaseEnv } from "../config/env.js";

export function createUserSupabaseClient(accessToken?: string) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getSupabaseEnv();

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

export function createAdminSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = getSupabaseAdminEnv();

  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
