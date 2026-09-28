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

export const verifySupabaseAccessToken: AccessTokenVerifier = async (
  accessToken,
) => {
  const authClient = createUserSupabaseClient();
  const { data: claimsData, error: claimsError } =
    await authClient.auth.getClaims(accessToken);
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) {
    throw new AppError(
      "La sesión no es válida o expiró",
      401,
      "INVALID_SESSION",
    );
  }

  const supabase = createUserSupabaseClient(accessToken);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role, active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profileError) {
    throw new AppError(
      "No fue posible verificar el perfil del usuario",
      503,
      "PROFILE_LOOKUP_FAILED",
    );
  }
  if (!profile || !profile.active) {
    throw new AppError(
      "El usuario no tiene un perfil activo",
      403,
      "PROFILE_INACTIVE",
    );
  }

  return {
    accessToken,
    assuranceLevel: claims.aal === "aal2" ? "aal2" : "aal1",
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    },
    profile: {
      id: profile.id,
      organizationId: profile.organization_id,
      fullName: profile.full_name,
      role: profile.role,
    },
    supabase,
  };
};

export function createAuthenticate(
  verifier: AccessTokenVerifier = verifySupabaseAccessToken,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const accessToken = readBearerToken(request.header("authorization"));
      if (!accessToken) {
        throw new AppError(
          "Debes iniciar sesión para continuar",
          401,
          "AUTH_REQUIRED",
        );
      }

      request.auth = await verifier(accessToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate();
