import { z } from "zod";
import { uuidSchema } from "./common.schema.js";

export const recordDeliveryEventRequestSchema = z.object({
  body: z.object({ event: z.enum(["arrived", "delivered"]) }).strict(),
  params: z.object({ serviceDayId: uuidSchema }),
  query: z.object({}),
});

export const confirmServiceReceiptRequestSchema = z.object({
  body: z.object({ confirmed: z.literal(true) }).strict(),
  params: z.object({ serviceDayId: uuidSchema }),
  query: z.object({}),
});

export type RecordDeliveryEventRequest = z.infer<typeof recordDeliveryEventRequestSchema>;
export type ConfirmServiceReceiptRequest = z.infer<typeof confirmServiceReceiptRequestSchema>;
