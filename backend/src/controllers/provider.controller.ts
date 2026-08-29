import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
  MarkFulfillmentRequest,
  CreateCalendarBlockRequest,
  DeleteCalendarBlockRequest,
  ListCalendarBlocksRequest,
  ResolveExceptionRequest,
  UpdateAvailabilityRequest,
  WeeklyReportRequest,
} from "../schemas/provider.schema.js";
import {
  getWeeklyProviderReport,
  getProviderOperations,
  createCalendarBlock,
  deleteCalendarBlock,
  listCalendarBlocks,
  markOrderFulfillment,
  resolveExceptionalRequest,
  setMenuOptionAvailability,
} from "../services/provider.service.js";
import type {
  PublishMenuWeekRequest,
  SaveMenuWeekDraftRequest,
} from "../schemas/menu.schema.js";
import { publishMenuWeek, saveMenuWeekDraft } from "../services/menu.service.js";
import type { ReportRequest } from "../schemas/report.schema.js";
import { getOrdersReport } from "../services/report.service.js";

export const patchMenuOptionAvailability: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<UpdateAvailabilityRequest>(request);
  const menuOption = await setMenuOptionAvailability(supabase, {
    menuOptionId: params.menuOptionId,
    capacity: body.capacity,
    visible: body.visible,
  });
  response.status(200).json({ data: menuOption });
};

export const getWeeklyReport: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<WeeklyReportRequest>(request);
  const report = await getWeeklyProviderReport(supabase, query.startsOn);
  response.status(200).json({ data: report });
};

export const getProviderReport: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<ReportRequest>(request);
  const report = await getOrdersReport(supabase, query);
  response.status(200).json({ data: report });
};

export const getOperationalDetail: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<WeeklyReportRequest>(request);
  const operations = await getProviderOperations(supabase, query.startsOn);
  response.status(200).json({ data: operations });
};

export const patchOrderFulfillment: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<MarkFulfillmentRequest>(request);
  const order = await markOrderFulfillment(supabase, {
    orderId: params.orderId,
    delivered: body.delivered,
  });
  response.status(200).json({ data: order });
};

export const patchExceptionalRequest: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<ResolveExceptionRequest>(request);
  const exception = await resolveExceptionalRequest(supabase, {
    exceptionId: params.exceptionId,
    status: body.status,
    resolutionNote: body.resolutionNote,
  });
  response.status(200).json({ data: exception });
};

export const putMenuWeekDraft: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<SaveMenuWeekDraftRequest>(request);
  const menu = await saveMenuWeekDraft(supabase, {
    startsOn: params.startsOn,
    days: body.days,
  });
  response.status(200).json({ data: menu });
};

export const postPublishMenuWeek: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<PublishMenuWeekRequest>(request);
  const menu = await publishMenuWeek(supabase, params.weekId);
  response.status(200).json({ data: menu });
};

export const getCalendarBlocks: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<ListCalendarBlocksRequest>(request);
  const blocks = await listCalendarBlocks(supabase, query);
  response.status(200).json({ data: blocks });
};

export const postCalendarBlock: RequestHandler = async (request, response) => {
  const { supabase, profile } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateCalendarBlockRequest>(request);
  const block = await createCalendarBlock(supabase, {
    organizationId: profile.organizationId,
    actorId: profile.id,
    ...body,
  });
  response.status(201).json({ data: block });
};

export const removeCalendarBlock: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<DeleteCalendarBlockRequest>(request);
  const result = await deleteCalendarBlock(supabase, params.blockId);
  response.status(200).json({ data: result });
};
