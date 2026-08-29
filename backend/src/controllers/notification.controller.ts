import type { RequestHandler } from "express";
import { getRequestAuth, getValidatedRequest } from "../lib/request-data.js";
import type {
  ListNotificationsRequest,
  ReadNotificationRequest,
} from "../schemas/notification.schema.js";
import {
  listNotifications,
  markNotificationRead,
} from "../services/notification.service.js";

export const getNotifications: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { query } = getValidatedRequest<ListNotificationsRequest>(request);
  const notifications = await listNotifications(supabase, query);
  response.status(200).json({ data: notifications });
};

export const patchNotificationRead: RequestHandler = async (request, response) => {
  const { supabase } = getRequestAuth(request);
  const { params } = getValidatedRequest<ReadNotificationRequest>(request);
  const notification = await markNotificationRead(supabase, params.notificationId);
  response.status(200).json({ data: notification });
};
