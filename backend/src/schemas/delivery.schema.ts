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

export const recordCompanyArrivalRequestSchema = z.object({
  body: z.object({ confirmed: z.literal(true) }).strict(),
  params: z.object({ serviceDayId: uuidSchema }),
  query: z.object({}),
});

const receiptItemSchema = z.object({
  key: z.string().trim().min(1).max(160),
  receivedQuantity: z.number().int().min(0).max(100_000),
  note: z.string().trim().max(500).nullable().optional(),
}).strict();

export const saveServiceReceiptCheckRequestSchema = z.object({
  body: z.object({
    items: z.array(receiptItemSchema).max(100),
    generalNote: z.string().trim().max(1000).nullable().optional(),
  }).strict(),
  params: z.object({ serviceDayId: uuidSchema }),
  query: z.object({}),
});

export type RecordDeliveryEventRequest = z.infer<typeof recordDeliveryEventRequestSchema>;
export type ConfirmServiceReceiptRequest = z.infer<typeof confirmServiceReceiptRequestSchema>;
export type RecordCompanyArrivalRequest = z.infer<typeof recordCompanyArrivalRequestSchema>;
export type SaveServiceReceiptCheckRequest = z.infer<typeof saveServiceReceiptCheckRequestSchema>;
