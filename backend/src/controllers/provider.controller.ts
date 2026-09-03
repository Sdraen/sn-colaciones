import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
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
  resolveExceptionalRequest,
  setMenuOptionAvailability,
} from "../services/provider.service.js";
import type {
  CopyMenuWeekRequest,
  CreateMenuWeekRequest,
  DeleteMenuWeekRequest,
  PublishMenuWeekRequest,
  UpdateMenuWeekRequest,
} from "../schemas/menu.schema.js";
import {
  copyPreviousMenuWeek,
  createMenuWeekDraft,
  deleteMenuWeekDraft,
  publishMenuWeek,
  updateMenuWeekDraft,
} from "../services/menu.service.js";
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

export const patchExceptionalRequest: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<ResolveExceptionRequest>(request);
  const extraRequest = await resolveExceptionalRequest(supabase, {
    requestId: params.requestId,
    status: body.status,
    resolutionNote: body.resolutionNote,
  });
  response.status(200).json({ data: extraRequest });
};

export const postMenuWeek: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CreateMenuWeekRequest>(request);
  const menu = await createMenuWeekDraft(supabase, {
    startsOn: body.startsOn,
    days: body.days,
  });
  response.status(201).json({ data: menu });
};

export const putMenuWeek: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params, body } = getValidatedRequest<UpdateMenuWeekRequest>(request);
  const menu = await updateMenuWeekDraft(supabase, {
    menuWeekId: params.weekId,
    startsOn: body.startsOn,
    days: body.days,
  });
  response.status(200).json({ data: menu });
};

export const removeMenuWeek: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<DeleteMenuWeekRequest>(request);
  await deleteMenuWeekDraft(supabase, params.weekId);
  response.status(204).send();
};

export const postCopyMenuWeek: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<CopyMenuWeekRequest>(request);
  const menu = await copyPreviousMenuWeek(supabase, body.targetStartsOn);
  response.status(201).json({ data: menu });
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
