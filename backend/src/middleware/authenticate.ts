import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { createUserSupabaseClient } from "../lib/supabase.js";
import type { RequestAuth } from "../models/auth.js";

export type AccessTokenVerifier = (accessToken: string) => Promise<RequestAuth>;

export function readBearerToken(authorizationHeader?: string) {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1]?.trim() || null;
}

export const verifySupabaseAccessToken: AccessTokenVerifier = async (accessToken) => {
  const authClient = createUserSupabaseClient();
  const { data: userData, error: authError } = await authClient.auth.getUser(accessToken);

  if (authError || !userData.user) {
    throw new AppError("La sesión no es válida o expiró", 401, "INVALID_SESSION");
  }

  const supabase = createUserSupabaseClient(accessToken);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role, active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new AppError(
      "No fue posible verificar el perfil del usuario",
      503,
      "PROFILE_LOOKUP_FAILED",
    );
  }
  if (!profile || !profile.active) {
    throw new AppError("El usuario no tiene un perfil activo", 403, "PROFILE_INACTIVE");
  }

  return {
    accessToken,
    user: userData.user,
    profile: {
      id: profile.id,
      organizationId: profile.organization_id,
      fullName: profile.full_name,
      role: profile.role,
    },
    supabase,
  };
};

export function createAuthenticate(verifier: AccessTokenVerifier = verifySupabaseAccessToken): RequestHandler {
  return async (request, _response, next) => {
    try {
      const accessToken = readBearerToken(request.header("authorization"));
      if (!accessToken) {
        throw new AppError("Debes iniciar sesión para continuar", 401, "AUTH_REQUIRED");
      }

      request.auth = await verifier(accessToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate();
