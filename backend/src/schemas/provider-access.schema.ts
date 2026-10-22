import { z } from "zod";
import { uuidSchema } from "./common.schema.js";

export const providerManagedRoleSchema = z.enum([
  "delivery",
  "company_admin",
  "external_worker",
]);

export const createProviderAccessRequestSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      fullName: z.string().trim().min(3).max(120),
      role: providerManagedRoleSchema,
      companyName: z.string().trim().min(2).max(120).optional(),
    })
    .superRefine((body, context) => {
      if (body.role === "external_worker" && !body.companyName) {
        context.addIssue({
          code: "custom",
          path: ["companyName"],
          message: "Debes indicar la empresa de la persona externa",
        });
      }
    }),
  params: z.object({}),
  query: z.object({}),
});

export const listProviderAccessRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({}),
});

export const sendProviderAccessPasswordSetupRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ accessUserId: uuidSchema }),
  query: z.object({}),
});

export const updateProviderAccessStatusRequestSchema = z.object({
  body: z.object({ active: z.boolean() }),
  params: z.object({ accessUserId: uuidSchema }),
  query: z.object({}),
});

export type ProviderManagedRole = z.infer<typeof providerManagedRoleSchema>;
export type CreateProviderAccessRequest = z.infer<
  typeof createProviderAccessRequestSchema
>;
export type SendProviderAccessPasswordSetupRequest = z.infer<
  typeof sendProviderAccessPasswordSetupRequestSchema
>;
export type UpdateProviderAccessStatusRequest = z.infer<
  typeof updateProviderAccessStatusRequestSchema
>;
