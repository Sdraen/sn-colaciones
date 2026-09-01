import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type { DailySummaryRequest } from "../schemas/summary.schema.js";
import { getDailySummary } from "../services/daily-summary.service.js";

export const getDailyOperationalSummary: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<DailySummaryRequest>(request);
  const summary = await getDailySummary(supabase, query.date);
  response.status(200).json({ data: summary });
};
