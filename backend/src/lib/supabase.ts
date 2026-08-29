import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv, getSupabaseEnv } from "../config/env.js";
import type { Database } from "../types/database.js";

export function createUserSupabaseClient(accessToken?: string) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getSupabaseEnv();

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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

  return createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
