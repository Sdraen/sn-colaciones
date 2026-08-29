import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./common.schema.js";

const mealSelectionSchema = z.object({
  serviceDayId: uuidSchema,
  menuOptionId: uuidSchema,
  side: z.enum(["ensalada", "postre", "ninguno"]),
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
    }),
  ),
  params: z.object({}),
  query: z.object({}),
});

export const createExceptionRequestSchema = z.object({
  body: requireBreadOrTea(
    mealSelectionSchema.extend({
      beneficiaryLabel: z.string().trim().min(2).max(120),
      reason: z.string().trim().min(5).max(500),
    }),
  ),
  params: z.object({}),
  query: z.object({}),
});

export const companyOperationsRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({ startsOn: isoDateSchema.optional() }),
});

export type CreateTrainingRequest = z.infer<typeof createTrainingRequestSchema>;
export type CreateExtraRequest = z.infer<typeof createExtraRequestSchema>;
export type CreateExceptionRequest = z.infer<typeof createExceptionRequestSchema>;
export type CompanyOperationsRequest = z.infer<typeof companyOperationsRequestSchema>;
