import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import type { AppRole } from "../types/database.js";

export function requireRole(...allowedRoles: AppRole[]): RequestHandler {
  const allowed = new Set(allowedRoles);

  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError("Falta el contexto de autenticación", 500, "AUTH_CONTEXT_MISSING"));
      return;
    }
    if (!allowed.has(request.auth.profile.role)) {
      next(new AppError("No tienes permisos para esta acción", 403, "FORBIDDEN"));
      return;
    }
    next();
  };
}
