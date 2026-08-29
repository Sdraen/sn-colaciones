import { Router } from "express";
import {
  getCompanyReport,
  getOperations,
  postExceptionalRequest,
  postExtraOrder,
  postTrainingOrder,
} from "../controllers/company.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  companyOperationsRequestSchema,
  createExceptionRequestSchema,
  createExtraRequestSchema,
  createTrainingRequestSchema,
} from "../schemas/company.schema.js";
import { reportRequestSchema } from "../schemas/report.schema.js";

export const companyRouter = Router();

companyRouter.use(requireRole("company_admin"));
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
companyRouter.post(
  "/exceptions",
  validateRequest(createExceptionRequestSchema),
  postExceptionalRequest,
);
