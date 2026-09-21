import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../errors/app-error.js";

function reject(message: string, code: string): RequestHandler {
  return (request, _response, next) => {
    next(new AppError(message, 429, code, { requestId: request.requestId }));
  };
}

function authenticatedKey(request: Request) {
  return request.auth?.user.id ?? ipKeyGenerator(request.ip ?? "unknown");
}

export const edgeRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 3_000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (request) => ipKeyGenerator(request.ip ?? "unknown"),
  handler: reject(
    "El sistema recibio demasiadas solicitudes. Espera un momento e intenta nuevamente.",
    "RATE_LIMIT_EXCEEDED",
  ),
});

export const authenticatedRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: authenticatedKey,
  handler: reject(
    "Realizaste demasiadas solicitudes en poco tiempo. Espera un momento.",
    "USER_RATE_LIMIT_EXCEEDED",
  ),
});

export const accountManagementRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: authenticatedKey,
  handler: reject(
    "Se alcanzo el limite temporal de gestion de accesos. Intenta nuevamente mas tarde.",
    "ACCOUNT_RATE_LIMIT_EXCEEDED",
  ),
});

export const reportRateLimit = rateLimit({
  windowMs: 5 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: authenticatedKey,
  handler: reject(
    "Se alcanzo el limite temporal de generacion de reportes.",
    "REPORT_RATE_LIMIT_EXCEEDED",
  ),
});
