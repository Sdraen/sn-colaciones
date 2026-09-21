import type { SupabaseClient, User } from "@supabase/supabase-js";
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
  user: User;
  profile: AuthenticatedProfile;
  supabase: SupabaseClient<Database>;
}
