import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./common.schema.js";

export const saveRegularOrderRequestSchema = z.object({
  body: z
    .object({
      serviceDayId: uuidSchema,
      menuOptionId: uuidSchema,
      side: z.enum(["ensalada", "postre", "ninguno"]),
      bread: z.boolean().default(false),
      tea: z.boolean().default(false),
    })
    .refine((body) => body.bread !== body.tea, {
      path: ["bread"],
      message: "Debes elegir pan o té, pero no ambos",
    }),
  params: z.object({}),
  query: z.object({}),
});

export const listMyOrdersRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({
    startsOn: isoDateSchema.optional(),
  }),
});

export const cancelOrderRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ orderId: uuidSchema }),
  query: z.object({}),
});

export type SaveRegularOrderRequest = z.infer<typeof saveRegularOrderRequestSchema>;
export type ListMyOrdersRequest = z.infer<typeof listMyOrdersRequestSchema>;
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;
