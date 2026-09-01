import { Router } from "express";
import { getDailyOperationalSummary } from "../controllers/summary.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { dailySummaryRequestSchema } from "../schemas/summary.schema.js";

export const summaryRouter = Router();

summaryRouter.use(requireRole("company_admin", "provider_admin", "delivery"));
summaryRouter.get("/daily", validateRequest(dailySummaryRequestSchema), getDailyOperationalSummary);
