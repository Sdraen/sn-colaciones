import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole, Database } from "../types/database.js";

export interface AuthenticatedProfile {
  id: string;
  organizationId: string;
  fullName: string;
  role: AppRole;
}

export interface RequestAuth {
  accessToken: string;
  assuranceLevel: "aal1" | "aal2";
  user: {
    id: string;
    email: string | null;
  };
  profile: AuthenticatedProfile;
  supabase: SupabaseClient<Database>;
}
