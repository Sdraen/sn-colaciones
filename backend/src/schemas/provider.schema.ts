import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./common.schema.js";

export const updateAvailabilityRequestSchema = z.object({
  body: z.object({
    capacity: z.number().int().min(0).max(10_000).nullable(),
    visible: z.boolean().optional(),
  }),
  params: z.object({ menuOptionId: uuidSchema }),
  query: z.object({}),
});

export const weeklyReportRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({ startsOn: isoDateSchema.optional() }),
});

export const markFulfillmentRequestSchema = z.object({
  body: z.object({ delivered: z.boolean() }),
  params: z.object({ orderId: uuidSchema }),
  query: z.object({}),
});

export const resolveExceptionRequestSchema = z
  .object({
    body: z.object({
      status: z.enum(["approved", "rejected"]),
      resolutionNote: z.string().trim().min(5).max(500).optional(),
    }),
    params: z.object({ exceptionId: uuidSchema }),
    query: z.object({}),
  })
  .superRefine((request, context) => {
    if (request.body.status === "rejected" && !request.body.resolutionNote) {
      context.addIssue({
        code: "custom",
        path: ["body", "resolutionNote"],
        message: "Debes indicar un motivo para rechazar",
      });
    }
  });

export const listCalendarBlocksRequestSchema = z
  .object({
    body: z.unknown(),
    params: z.object({}),
    query: z.object({
      from: isoDateSchema.optional(),
      to: isoDateSchema.optional(),
    }),
  })
  .refine(
    (request) => !request.query.from || !request.query.to || request.query.from <= request.query.to,
    { path: ["query", "to"], message: "La fecha final debe ser posterior a la inicial" },
  );

export const createCalendarBlockRequestSchema = z
  .object({
    body: z.object({
      startsOn: isoDateSchema,
      endsOn: isoDateSchema,
      kind: z.enum(["holiday", "vacation", "no_service", "special"]),
      reason: z.string().trim().min(3).max(300),
    }),
    params: z.object({}),
    query: z.object({}),
  })
  .refine((request) => request.body.startsOn <= request.body.endsOn, {
    path: ["body", "endsOn"],
    message: "La fecha final debe ser posterior a la inicial",
  });

export const deleteCalendarBlockRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ blockId: uuidSchema }),
  query: z.object({}),
});

export type UpdateAvailabilityRequest = z.infer<typeof updateAvailabilityRequestSchema>;
export type WeeklyReportRequest = z.infer<typeof weeklyReportRequestSchema>;
export type MarkFulfillmentRequest = z.infer<typeof markFulfillmentRequestSchema>;
export type ResolveExceptionRequest = z.infer<typeof resolveExceptionRequestSchema>;
export type ListCalendarBlocksRequest = z.infer<typeof listCalendarBlocksRequestSchema>;
export type CreateCalendarBlockRequest = z.infer<typeof createCalendarBlockRequestSchema>;
export type DeleteCalendarBlockRequest = z.infer<typeof deleteCalendarBlockRequestSchema>;
