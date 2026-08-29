import { Router } from "express";
import {
  getNotifications,
  patchNotificationRead,
} from "../controllers/notification.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  listNotificationsRequestSchema,
  readNotificationRequestSchema,
} from "../schemas/notification.schema.js";

export const notificationRouter = Router();

notificationRouter.get(
  "/",
  validateRequest(listNotificationsRequestSchema),
  getNotifications,
);
notificationRouter.patch(
  "/:notificationId/read",
  validateRequest(readNotificationRequestSchema),
  patchNotificationRead,
);
