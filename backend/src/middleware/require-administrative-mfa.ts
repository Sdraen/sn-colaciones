import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

const administrativeRoles = new Set(["provider_admin", "company_admin"]);

export const requireAdministrativeMfa: RequestHandler = (request, _response, next) => {
  if (!request.auth) {
    next(new AppError("Falta el contexto de autenticacion", 500, "AUTH_CONTEXT_MISSING"));
    return;
  }

  if (
    administrativeRoles.has(request.auth.profile.role) &&
    request.auth.assuranceLevel !== "aal2"
  ) {
    next(
      new AppError(
        "Debes verificar el codigo de autenticacion para continuar",
        403,
        "MFA_REQUIRED",
      ),
    );
    return;
  }

  next();
};
