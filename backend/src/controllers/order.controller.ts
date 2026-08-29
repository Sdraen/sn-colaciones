import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
  CancelOrderRequest,
  ListMyOrdersRequest,
  SaveRegularOrderRequest,
} from "../schemas/order.schema.js";
import {
  cancelRegularOrder,
  listWorkerOrders,
  saveRegularOrder,
} from "../services/order.service.js";

export const getMyOrders: RequestHandler = async (request, response) => {
  const { supabase, user } = getRequestAuth(request);
  const { query } = getValidatedRequest<ListMyOrdersRequest>(request);
  const result = await listWorkerOrders(supabase, user.id, query.startsOn);
  response.status(200).json({ data: result });
};

export const putMyOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { body } = getValidatedRequest<SaveRegularOrderRequest>(request);
  const order = await saveRegularOrder(supabase, body);
  response.status(200).json({ data: order });
};

export const deleteMyOrder: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<CancelOrderRequest>(request);
  const order = await cancelRegularOrder(supabase, params.orderId);
  response.status(200).json({ data: order });
};
