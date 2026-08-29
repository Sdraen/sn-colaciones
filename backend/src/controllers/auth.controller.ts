import type { RequestHandler } from "express";
import { getRequestAuth } from "../lib/request-data.js";

export const getCurrentUser: RequestHandler = (request, response) => {
  const { user, profile } = getRequestAuth(request);
  response.status(200).json({
    data: {
      id: user.id,
      email: user.email ?? null,
      fullName: profile.fullName,
      organizationId: profile.organizationId,
      role: profile.role,
    },
  });
};
