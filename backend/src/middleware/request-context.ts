import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const requestIdPattern = /^[a-zA-Z0-9._-]{8,128}$/;

export const requestContext: RequestHandler = (request, response, next) => {
  const incomingRequestId = request.header("x-request-id");
  request.requestId =
    incomingRequestId && requestIdPattern.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
};
