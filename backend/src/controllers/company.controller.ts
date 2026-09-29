import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
  CompanyOperationsRequest,
  CreateExtraRequest,
  CreateExtraBatchRequest,
  CreateSpecialMealRequest,
  CreateTrainingBatchRequest,
  CreateTrainingRequest,
  DeleteExtraRequestRequest,
  DeleteOperationalOrderRequest,
  UpdateExtraRequestRequest,
  UpdateOperationalOrderRequest,
} from "../schemas/company.schema.js";
import {
  createExtraOrder,
  createExtraBatch,
  createSpecialMealRequest,
  createTrainingOrder,
  createTrainingBatch,
  deleteCompanyExtraRequest,
  deleteCompanyOperationalOrder,
  getCompanyOperations,
  updateCompanyExtraRequest,
  updateCompanyOperationalOrder,
} from "../services/company.service.js";
import type { ReportRequest } from "../schemas/report.schema.js";
import { getCompleteOrdersReport, getNominalOrdersReport } from "../services/report.service.js";
import { createNominalOrdersPdf } from "../services/report-pdf.service.js";
import type {
  CreateWorkerAccountRequest,
  SendWorkerPasswordSetupRequest,
  UpdateWorkerStatusRequest,
} from "../schemas/worker-admin.schema.js";
import { createAdminSupabaseClient } from "../lib/supabase.js";
import {
  createWorkerAccount,
  listWorkerAccounts,
  sendWorkerPasswordSetupEmail,
  setWorkerAccountActive,
} from "../services/worker-admin.service.js";
import type {
  ConfirmServiceReceiptRequest,
  RecordCompanyArrivalRequest,
  SaveServiceReceiptCheckRequest,
} from "../schemas/delivery.schema.js";
import {
  confirmCompanyDeliveryArrival,
  confirmServiceReceipt,
  saveServiceReceiptCheck,
} from "../services/delivery.service.js";
import { getAppUrlEnv } from "../config/env.js";
import { recordSecurityAuditEvent } from "../services/security-audit.service.js";

export const postTrainingOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateTrainingRequest>(request);
  const order = await createTrainingOrder(supabase, body);
  response.status(201).json({ data: order });
};

export const postTrainingBatch: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateTrainingBatchRequest>(request);
  const orders = await createTrainingBatch(supabase, body);
  response.status(201).json({ data: orders });
};

export const postExtraOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateExtraRequest>(request);
  const result = await createExtraOrder(supabase, body);
  response.status(201).json({ data: result });
};

export const postExtraBatch: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateExtraBatchRequest>(request);
  const result = await createExtraBatch(supabase, body);
  response.status(201).json({ data: result });
};

export const postSpecialMealRequest: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateSpecialMealRequest>(request);
  const result = await createSpecialMealRequest(supabase, body);
  response.status(201).json({ data: result });
};

export const patchOperationalOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<UpdateOperationalOrderRequest>(request);
  const order = await updateCompanyOperationalOrder(supabase, {
    orderId: params.orderId,
    ...body,
  });
  response.status(200).json({ data: order });
};

export const deleteOperationalOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<DeleteOperationalOrderRequest>(request);
  const result = await deleteCompanyOperationalOrder(supabase, params.orderId);
  response.status(200).json({ data: result });
};

export const patchExtraRequest: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<UpdateExtraRequestRequest>(request);
  const extraRequest = await updateCompanyExtraRequest(supabase, {
    requestId: params.requestId,
    ...body,
  });
  response.status(200).json({ data: extraRequest });
};

export const deleteExtraRequest: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<DeleteExtraRequestRequest>(request);
  const result = await deleteCompanyExtraRequest(supabase, params.requestId);
  response.status(200).json({ data: result });
};

export const getOperations: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<CompanyOperationsRequest>(request);
  const operations = await getCompanyOperations(supabase, query.startsOn);
  response.status(200).json({ data: operations });
};

export const getCompanyReport: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<ReportRequest>(request);
  const report = await getCompleteOrdersReport(supabase, query);
  response.status(200).json({ data: report });
};

export const getCompanyReportPdf: RequestHandler = async (request, response) => {
  const { profile, supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<ReportRequest>(request);
  const report = await getNominalOrdersReport(supabase, query);
  const pdf = await createNominalOrdersPdf(report);
  await recordSecurityAuditEvent(createAdminSupabaseClient(), {
    organizationId: profile.organizationId,
    actorId: profile.id,
    entityType: "report",
    action: "report.nominal_pdf_downloaded",
    metadata: { period: query.period, from: report.range.from, to: report.range.to },
  });
  const fileName = `reporte-nominal-colaciones-${query.period}-${report.range.from}-${report.range.to}.pdf`;

  response.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Length": String(pdf.length),
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
  });
  response.status(200).send(pdf);
};

export const getWorkers: RequestHandler = async (request, response) => {
  const { profile } = getRequestAuth(request);
  const workers = await listWorkerAccounts(
    createAdminSupabaseClient(),
    profile.organizationId,
  );
  response.status(200).json({ data: workers });
};

export const postWorker: RequestHandler = async (request, response) => {
  const { profile } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateWorkerAccountRequest>(request);
  const worker = await createWorkerAccount(
    createAdminSupabaseClient(),
    profile.organizationId,
    {
      ...body,
      actorId: profile.id,
      passwordSetupRedirectTo: getPasswordSetupRedirectUrl(),
    },
  );
  response.status(201).json({ data: worker });
};

export const postWorkerPasswordSetup: RequestHandler = async (request, response) => {
  const { profile } = getRequestAuth(request);
  const { params } = getValidatedRequest<SendWorkerPasswordSetupRequest>(request);
  const result = await sendWorkerPasswordSetupEmail(
    createAdminSupabaseClient(),
    profile.organizationId,
    params.workerId,
    profile.id,
    getPasswordSetupRedirectUrl(),
  );
  response.status(200).json({ data: result });
};

export const patchWorkerStatus: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<UpdateWorkerStatusRequest>(request);
  const result = await setWorkerAccountActive(supabase, params.workerId, body.active);
  response.status(200).json({ data: result });
};

export const patchServiceReceipt: RequestHandler = async (request, response) => {
  const { profile, supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<ConfirmServiceReceiptRequest>(request);
  const tracking = await confirmServiceReceipt(supabase, params.serviceDayId, profile);
  response.status(200).json({ data: tracking });
};

export const patchCompanyArrival: RequestHandler = async (request, response) => {
  const { profile, supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<RecordCompanyArrivalRequest>(request);
  const tracking = await confirmCompanyDeliveryArrival(
    supabase,
    params.serviceDayId,
    profile,
  );
  response.status(200).json({ data: tracking });
};

export const putServiceReceiptCheck: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<SaveServiceReceiptCheckRequest>(request);
  const receipt = await saveServiceReceiptCheck(supabase, {
    serviceDayId: params.serviceDayId,
    items: body.items,
    generalNote: body.generalNote,
  });
  response.status(200).json({ data: receipt });
};

function getPasswordSetupRedirectUrl() {
  return new URL("/auth/activar", getAppUrlEnv().APP_URL).toString();
}
