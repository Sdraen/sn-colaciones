import { z } from "zod";
import { isoDateSchema } from "./common.schema.js";

export const dailySummaryRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({ date: isoDateSchema.optional() }),
});

export type DailySummaryRequest = z.infer<typeof dailySummaryRequestSchema>;
