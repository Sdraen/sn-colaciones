import { z } from "zod";
import { uuidSchema } from "./common.schema.js";

export const listNotificationsRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({
    unreadOnly: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
});

export const readNotificationRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ notificationId: uuidSchema }),
  query: z.object({}),
});

export type ListNotificationsRequest = z.infer<typeof listNotificationsRequestSchema>;
export type ReadNotificationRequest = z.infer<typeof readNotificationRequestSchema>;
