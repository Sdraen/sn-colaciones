import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
  CompanyOperationsRequest,
  CreateExtraRequest,
  CreateTrainingRequest,
} from "../schemas/company.schema.js";
import {
  createExtraOrder,
  createTrainingOrder,
  getCompanyOperations,
} from "../services/company.service.js";
import type { ReportRequest } from "../schemas/report.schema.js";
import { getOrdersReport } from "../services/report.service.js";
import type { CreateWorkerAccountRequest } from "../schemas/worker-admin.schema.js";
import { createAdminSupabaseClient } from "../lib/supabase.js";
import {
  createWorkerAccount,
  listWorkerAccounts,
} from "../services/worker-admin.service.js";
import type { ConfirmServiceReceiptRequest } from "../schemas/delivery.schema.js";
import { confirmServiceReceipt } from "../services/delivery.service.js";

export const postTrainingOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateTrainingRequest>(request);
  const order = await createTrainingOrder(supabase, body);
  response.status(201).json({ data: order });
};

export const postExtraOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateExtraRequest>(request);
  const result = await createExtraOrder(supabase, body);
  response.status(201).json({ data: result });
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
  const report = await getOrdersReport(supabase, query);
  response.status(200).json({ data: report });
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
    body,
  );
  response.status(201).json({ data: worker });
};

export const patchServiceReceipt: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<ConfirmServiceReceiptRequest>(request);
  const tracking = await confirmServiceReceipt(supabase, params.serviceDayId);
  response.status(200).json({ data: tracking });
};
