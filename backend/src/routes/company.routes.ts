import { Router } from "express";
import {
  getCompanyReport,
  getCompanyReportPdf,
  getOperations,
  getWorkers,
  deleteExtraRequest,
  deleteOperationalOrder,
  postExtraOrder,
  postTrainingOrder,
  postWorker,
  postWorkerPasswordSetup,
  patchWorkerStatus,
  patchServiceReceipt,
  patchCompanyArrival,
  putServiceReceiptCheck,
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
  sendWorkerPasswordSetupRequestSchema,
  updateWorkerStatusRequestSchema,
} from "../schemas/worker-admin.schema.js";
import {
  accountManagementRateLimit,
  reportRateLimit,
} from "../middleware/rate-limit.js";
import {
  confirmServiceReceiptRequestSchema,
  recordCompanyArrivalRequestSchema,
  saveServiceReceiptCheckRequestSchema,
} from "../schemas/delivery.schema.js";

export const companyRouter = Router();

companyRouter.use(requireRole("company_admin"));
companyRouter.get(
  "/workers",
  validateRequest(listWorkerAccountsRequestSchema),
  getWorkers,
);
companyRouter.post(
  "/workers",
  accountManagementRateLimit,
  validateRequest(createWorkerAccountRequestSchema),
  postWorker,
);
companyRouter.patch(
  "/workers/:workerId/status",
  accountManagementRateLimit,
  validateRequest(updateWorkerStatusRequestSchema),
  patchWorkerStatus,
);
companyRouter.post(
  "/workers/:workerId/password-setup",
  accountManagementRateLimit,
  validateRequest(sendWorkerPasswordSetupRequestSchema),
  postWorkerPasswordSetup,
);
companyRouter.get(
  "/reports/pdf",
  reportRateLimit,
  validateRequest(reportRequestSchema),
  getCompanyReportPdf,
);
companyRouter.get(
  "/reports",
  reportRateLimit,
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
  "/service-days/:serviceDayId/arrival",
  validateRequest(recordCompanyArrivalRequestSchema),
  patchCompanyArrival,
);
companyRouter.put(
  "/service-days/:serviceDayId/receipt-check",
  validateRequest(saveServiceReceiptCheckRequestSchema),
  putServiceReceiptCheck,
);
companyRouter.patch(
  "/service-days/:serviceDayId/receipt",
  validateRequest(confirmServiceReceiptRequestSchema),
  patchServiceReceipt,
);
