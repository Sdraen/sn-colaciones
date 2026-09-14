import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./common.schema.js";

const mealSelectionSchema = z.object({
  serviceDayId: uuidSchema,
  menuOptionId: uuidSchema,
  side: z.enum(["ensalada", "fruta", "postre", "ninguno"]),
  bread: z.boolean().default(false),
  tea: z.boolean().default(false),
});

function requireBreadOrTea<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (body) =>
      "bread" in body && "tea" in body && body.bread !== body.tea,
    {
      path: ["bread"],
      message: "Debes elegir pan o té, pero no ambos",
    },
  );
}

export const createTrainingRequestSchema = z.object({
  body: requireBreadOrTea(
    mealSelectionSchema.extend({
      name: z.string().trim().min(3).max(120),
      attendeeCount: z.number().int().min(1).max(500),
    }),
  ),
  params: z.object({}),
  query: z.object({}),
});

export const createExtraRequestSchema = z.object({
  body: requireBreadOrTea(
    mealSelectionSchema.extend({
      beneficiaryLabel: z.string().trim().min(2).max(120),
      reason: z.string().trim().min(5).max(500).optional(),
    }),
  ),
  params: z.object({}),
  query: z.object({}),
});

const operationalCorrectionSchema = requireBreadOrTea(
  mealSelectionSchema.omit({ serviceDayId: true }).extend({
    name: z.string().trim().min(2).max(120),
    attendeeCount: z.number().int().min(1).max(500).nullable().default(null),
  }),
);

export const updateOperationalOrderRequestSchema = z.object({
  body: operationalCorrectionSchema,
  params: z.object({ orderId: uuidSchema }),
  query: z.object({}),
});

export const deleteOperationalOrderRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ orderId: uuidSchema }),
  query: z.object({}),
});

export const updateExtraRequestRequestSchema = z.object({
  body: requireBreadOrTea(
    mealSelectionSchema.omit({ serviceDayId: true }).extend({
      beneficiaryLabel: z.string().trim().min(2).max(120),
      reason: z.string().trim().min(5).max(500),
    }),
  ),
  params: z.object({ requestId: uuidSchema }),
  query: z.object({}),
});

export const deleteExtraRequestRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ requestId: uuidSchema }),
  query: z.object({}),
});

export const companyOperationsRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({ startsOn: isoDateSchema.optional() }),
});

export type CreateTrainingRequest = z.infer<typeof createTrainingRequestSchema>;
export type CreateExtraRequest = z.infer<typeof createExtraRequestSchema>;
export type UpdateOperationalOrderRequest = z.infer<typeof updateOperationalOrderRequestSchema>;
export type DeleteOperationalOrderRequest = z.infer<typeof deleteOperationalOrderRequestSchema>;
export type UpdateExtraRequestRequest = z.infer<typeof updateExtraRequestRequestSchema>;
export type DeleteExtraRequestRequest = z.infer<typeof deleteExtraRequestRequestSchema>;
export type CompanyOperationsRequest = z.infer<typeof companyOperationsRequestSchema>;
