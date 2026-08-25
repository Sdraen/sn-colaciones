import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

export function notFoundHandler(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  next(new AppError(`Ruta no encontrada: ${request.method} ${request.path}`, 404, "NOT_FOUND"));
}
