import { z } from "zod";
import { uuidSchema } from "./common.schema.js";

export const providerManagedRoleSchema = z.enum(["delivery", "company_admin"]);

export const createProviderAccessRequestSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    fullName: z.string().trim().min(3).max(120),
    role: providerManagedRoleSchema,
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

export type ProviderManagedRole = z.infer<typeof providerManagedRoleSchema>;
export type CreateProviderAccessRequest = z.infer<
  typeof createProviderAccessRequestSchema
>;
export type SendProviderAccessPasswordSetupRequest = z.infer<
  typeof sendProviderAccessPasswordSetupRequestSchema
>;
