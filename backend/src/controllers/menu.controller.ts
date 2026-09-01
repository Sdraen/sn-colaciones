import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type { GetMenuWeekRequest } from "../schemas/menu.schema.js";
import { getMenuWeek } from "../services/menu.service.js";

export const getCurrentMenuWeek: RequestHandler = async (request, response) => {
  const { supabase, profile } = getRequestAuth(request);
  const { query } = getValidatedRequest<GetMenuWeekRequest>(request);
  const menu = await getMenuWeek(supabase, {
    startsOn: query.startsOn,
    includeDrafts: profile.role === "provider_admin",
    availableForWorkersOnly: profile.role === "worker",
  });
  response.status(200).json({ data: menu });
};
