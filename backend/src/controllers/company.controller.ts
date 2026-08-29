import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
  CompanyOperationsRequest,
  CreateExceptionRequest,
  CreateExtraRequest,
  CreateTrainingRequest,
} from "../schemas/company.schema.js";
import {
  createExceptionalRequest,
  createExtraOrder,
  createTrainingOrder,
  getCompanyOperations,
} from "../services/company.service.js";
import type { ReportRequest } from "../schemas/report.schema.js";
import { getOrdersReport } from "../services/report.service.js";

export const postTrainingOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateTrainingRequest>(request);
  const order = await createTrainingOrder(supabase, body);
  response.status(201).json({ data: order });
};

export const postExtraOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateExtraRequest>(request);
  const order = await createExtraOrder(supabase, body);
  response.status(201).json({ data: order });
};

export const postExceptionalRequest: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateExceptionRequest>(request);
  const exception = await createExceptionalRequest(supabase, body);
  response.status(201).json({ data: exception });
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
