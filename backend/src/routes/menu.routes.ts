import { Router } from "express";
import { getCurrentMenuWeek } from "../controllers/menu.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import { getMenuWeekRequestSchema } from "../schemas/menu.schema.js";

export const menuRouter = Router();

menuRouter.get("/current", validateRequest(getMenuWeekRequestSchema), getCurrentMenuWeek);
