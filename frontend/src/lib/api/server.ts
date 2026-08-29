import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getApiUrl } from "./config";
import type { ApiErrorPayload, AppRole, CurrentUser } from "./types";

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export const getCurrentApiUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) return null;

  try {
    return await backendRequest<CurrentUser>("/api/v1/auth/me");
  } catch (error) {
    if (error instanceof BackendApiError && [401, 403].includes(error.status)) {
      return null;
    }
    throw error;
  }
});

export async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new BackendApiError("Debes iniciar sesión", 401, "AUTH_REQUIRED");
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as
    | { data?: T }
    | ApiErrorPayload;
  if (!response.ok) {
    const apiError = "error" in payload ? payload.error : undefined;
    throw new BackendApiError(
      apiError?.message ?? "No fue posible completar la solicitud",
      response.status,
      apiError?.code ?? "API_ERROR",
      apiError?.requestId,
    );
  }
  if (!("data" in payload)) {
    throw new BackendApiError("La API devolvió una respuesta inesperada", 502, "INVALID_API_RESPONSE");
  }
  return payload.data as T;
}

export async function requireApiRole(role: AppRole) {
  const user = await getCurrentApiUser();
  if (!user || user.role !== role) return null;
  return user;
}

export async function backendRequestOrNull<T>(
  path: string,
  missingCodes: string[] = ["MENU_WEEK_NOT_FOUND"],
) {
  try {
    return await backendRequest<T>(path);
  } catch (error) {
    if (
      error instanceof BackendApiError &&
      (error.status === 404 || missingCodes.includes(error.code))
    ) {
      return null;
    }
    throw error;
  }
}
