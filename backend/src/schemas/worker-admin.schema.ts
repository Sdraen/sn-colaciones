import { z } from "zod";
import { uuidSchema } from "./common.schema.js";

export const createWorkerAccountRequestSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      dinerId: uuidSchema.optional(),
      fullName: z.string().trim().min(3).max(120).optional(),
      employeeCode: z.string().trim().min(1).max(80).optional(),
    })
    .superRefine((body, context) => {
      if (!body.dinerId && !body.fullName) {
        context.addIssue({
          code: "custom",
          path: ["fullName"],
          message: "Debes indicar el nombre del nuevo trabajador",
        });
      }
    }),
  params: z.object({}),
  query: z.object({}),
});

export const listWorkerAccountsRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({}),
});

export type CreateWorkerAccountRequest = z.infer<
  typeof createWorkerAccountRequestSchema
>;
