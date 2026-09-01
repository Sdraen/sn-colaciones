import { Router } from "express";
import {
  getProviderReport,
  getWeeklyReport,
  getOperationalDetail,
  getCalendarBlocks,
  patchExceptionalRequest,
  patchMenuOptionAvailability,
  patchOrderFulfillment,
  postCopyMenuWeek,
  postMenuWeek,
  postPublishMenuWeek,
  postCalendarBlock,
  removeCalendarBlock,
  removeMenuWeek,
  putMenuWeek,
} from "../controllers/provider.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  markFulfillmentRequestSchema,
  createCalendarBlockRequestSchema,
  deleteCalendarBlockRequestSchema,
  listCalendarBlocksRequestSchema,
  resolveExceptionRequestSchema,
  updateAvailabilityRequestSchema,
  weeklyReportRequestSchema,
} from "../schemas/provider.schema.js";
import {
  copyMenuWeekRequestSchema,
  createMenuWeekRequestSchema,
  deleteMenuWeekRequestSchema,
  publishMenuWeekRequestSchema,
  updateMenuWeekRequestSchema,
} from "../schemas/menu.schema.js";
import { reportRequestSchema } from "../schemas/report.schema.js";

export const providerRouter = Router();

providerRouter.use(requireRole("provider_admin"));
providerRouter.get(
  "/reports",
  validateRequest(reportRequestSchema),
  getProviderReport,
);
providerRouter.get(
  "/reports/weekly",
  validateRequest(weeklyReportRequestSchema),
  getWeeklyReport,
);
providerRouter.get(
  "/operations",
  validateRequest(weeklyReportRequestSchema),
  getOperationalDetail,
);
providerRouter.get(
  "/calendar-blocks",
  validateRequest(listCalendarBlocksRequestSchema),
  getCalendarBlocks,
);
providerRouter.post(
  "/calendar-blocks",
  validateRequest(createCalendarBlockRequestSchema),
  postCalendarBlock,
);
providerRouter.delete(
  "/calendar-blocks/:blockId",
  validateRequest(deleteCalendarBlockRequestSchema),
  removeCalendarBlock,
);
providerRouter.post(
  "/menu-weeks",
  validateRequest(createMenuWeekRequestSchema),
  postMenuWeek,
);
providerRouter.post(
  "/menu-weeks/copy",
  validateRequest(copyMenuWeekRequestSchema),
  postCopyMenuWeek,
);
providerRouter.put(
  "/menu-weeks/:weekId",
  validateRequest(updateMenuWeekRequestSchema),
  putMenuWeek,
);
providerRouter.delete(
  "/menu-weeks/:weekId",
  validateRequest(deleteMenuWeekRequestSchema),
  removeMenuWeek,
);
providerRouter.post(
  "/menu-weeks/:weekId/publish",
  validateRequest(publishMenuWeekRequestSchema),
  postPublishMenuWeek,
);
providerRouter.patch(
  "/menu-options/:menuOptionId/availability",
  validateRequest(updateAvailabilityRequestSchema),
  patchMenuOptionAvailability,
);
providerRouter.patch(
  "/extra-requests/:requestId",
  validateRequest(resolveExceptionRequestSchema),
  patchExceptionalRequest,
);
providerRouter.patch(
  "/orders/:orderId/fulfillment",
  validateRequest(markFulfillmentRequestSchema),
  patchOrderFulfillment,
);
