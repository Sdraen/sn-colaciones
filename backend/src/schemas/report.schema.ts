import { z } from "zod";
import { isoDateSchema } from "./common.schema.js";

export const reportPeriodSchema = z.enum(["daily", "weekly", "monthly"]);

export const reportRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({
    period: reportPeriodSchema.default("daily"),
    date: isoDateSchema.optional(),
  }),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
