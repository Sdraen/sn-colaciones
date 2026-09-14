import { Router } from "express";
import {
  getCompanyReport,
  getOperations,
  getWorkers,
  deleteExtraRequest,
  deleteOperationalOrder,
  postExtraOrder,
  postTrainingOrder,
  postWorker,
  patchServiceReceipt,
  patchExtraRequest,
  patchOperationalOrder,
} from "../controllers/company.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  companyOperationsRequestSchema,
  createExtraRequestSchema,
  createTrainingRequestSchema,
  deleteExtraRequestRequestSchema,
  deleteOperationalOrderRequestSchema,
  updateExtraRequestRequestSchema,
  updateOperationalOrderRequestSchema,
} from "../schemas/company.schema.js";
import { reportRequestSchema } from "../schemas/report.schema.js";
import {
  createWorkerAccountRequestSchema,
  listWorkerAccountsRequestSchema,
} from "../schemas/worker-admin.schema.js";
import { confirmServiceReceiptRequestSchema } from "../schemas/delivery.schema.js";

export const companyRouter = Router();

companyRouter.use(requireRole("company_admin"));
companyRouter.get(
  "/workers",
  validateRequest(listWorkerAccountsRequestSchema),
  getWorkers,
);
companyRouter.post(
  "/workers",
  validateRequest(createWorkerAccountRequestSchema),
  postWorker,
);
companyRouter.get(
  "/reports",
  validateRequest(reportRequestSchema),
  getCompanyReport,
);
companyRouter.get(
  "/operations",
  validateRequest(companyOperationsRequestSchema),
  getOperations,
);
companyRouter.post(
  "/training-sessions",
  validateRequest(createTrainingRequestSchema),
  postTrainingOrder,
);
companyRouter.post(
  "/extras",
  validateRequest(createExtraRequestSchema),
  postExtraOrder,
);
companyRouter.patch(
  "/orders/:orderId",
  validateRequest(updateOperationalOrderRequestSchema),
  patchOperationalOrder,
);
companyRouter.delete(
  "/orders/:orderId",
  validateRequest(deleteOperationalOrderRequestSchema),
  deleteOperationalOrder,
);
companyRouter.patch(
  "/extra-requests/:requestId",
  validateRequest(updateExtraRequestRequestSchema),
  patchExtraRequest,
);
companyRouter.delete(
  "/extra-requests/:requestId",
  validateRequest(deleteExtraRequestRequestSchema),
  deleteExtraRequest,
);
companyRouter.patch(
  "/service-days/:serviceDayId/receipt",
  validateRequest(confirmServiceReceiptRequestSchema),
  patchServiceReceipt,
);
