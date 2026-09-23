import { Router } from "express";
import {
  getProviderReport,
  getProviderReportPdf,
  getProviderAccessAccounts,
  getWeeklyReport,
  getOperationalDetail,
  getCalendarBlocks,
  patchExceptionalRequest,
  patchMenuOptionAvailability,
  patchProviderAccessStatus,
  postCopyMenuWeek,
  postMenuWeek,
  postPublishMenuWeek,
  postCalendarBlock,
  postProviderAccessAccount,
  postProviderAccessPasswordSetup,
  removeCalendarBlock,
  removeMenuWeek,
  putDailyTrainingMenus,
  putMenuWeek,
} from "../controllers/provider.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
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
  updateDailyTrainingMenusRequestSchema,
  updateMenuWeekRequestSchema,
} from "../schemas/menu.schema.js";
import { reportRequestSchema } from "../schemas/report.schema.js";
import {
  createProviderAccessRequestSchema,
  listProviderAccessRequestSchema,
  sendProviderAccessPasswordSetupRequestSchema,
  updateProviderAccessStatusRequestSchema,
} from "../schemas/provider-access.schema.js";
import {
  accountManagementRateLimit,
  reportRateLimit,
} from "../middleware/rate-limit.js";

export const providerRouter = Router();

providerRouter.use(requireRole("provider_admin"));
providerRouter.get(
  "/access-users",
  validateRequest(listProviderAccessRequestSchema),
  getProviderAccessAccounts,
);
providerRouter.post(
  "/access-users",
  accountManagementRateLimit,
  validateRequest(createProviderAccessRequestSchema),
  postProviderAccessAccount,
);
providerRouter.patch(
  "/access-users/:accessUserId/status",
  accountManagementRateLimit,
  validateRequest(updateProviderAccessStatusRequestSchema),
  patchProviderAccessStatus,
);
providerRouter.post(
  "/access-users/:accessUserId/password-setup",
  accountManagementRateLimit,
  validateRequest(sendProviderAccessPasswordSetupRequestSchema),
  postProviderAccessPasswordSetup,
);
providerRouter.get(
  "/reports/pdf",
  reportRateLimit,
  validateRequest(reportRequestSchema),
  getProviderReportPdf,
);
providerRouter.get(
  "/reports",
  reportRateLimit,
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
  "/service-days/:serviceDayId/training-menus",
  validateRequest(updateDailyTrainingMenusRequestSchema),
  putDailyTrainingMenus,
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
