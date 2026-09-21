export type AppRole = "worker" | "company_admin" | "provider_admin" | "delivery";

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string;
  organizationId: string;
  role: AppRole;
  assuranceLevel: "aal1" | "aal2";
  mfaRequired: boolean;
}

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown;
  };
}
