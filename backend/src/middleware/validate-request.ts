import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

export function validateRequest(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!result.success) {
      next(
        new AppError("La solicitud contiene datos inválidos", 400, "VALIDATION_ERROR", {
          fields: result.error.flatten().fieldErrors,
          form: result.error.flatten().formErrors,
        }),
      );
      return;
    }

    request.validated = result.data;
    next();
  };
}
