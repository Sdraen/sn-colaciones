import type { Request } from "express";
import { AppError } from "../errors/app-error.js";
import type { RequestAuth } from "../models/auth.js";

export function getRequestAuth(request: Request): RequestAuth {
  if (!request.auth) {
    throw new AppError("Falta el contexto de autenticación", 500, "AUTH_CONTEXT_MISSING");
  }
  return request.auth;
}

export function getValidatedRequest<T>(request: Request): T {
  if (!request.validated) {
    throw new AppError("Falta la validación de la solicitud", 500, "VALIDATION_CONTEXT_MISSING");
  }
  return request.validated as T;
}
