import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./common.schema.js";

const menuCategorySchema = z.enum([
  "principal",
  "vegetariano",
  "hipocalorico",
  "sandwich",
  "handroll",
  "especial",
]);

const menuOptionDraftSchema = z.object({
  category: menuCategorySchema,
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(300),
  capacity: z.number().int().min(0).max(10_000).nullable().default(null),
  trainingMenu: z.boolean().default(false),
  visible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

const menuDayDraftSchema = z.object({
  serviceDate: isoDateSchema,
  disabled: z.boolean().default(false),
  options: z.array(menuOptionDraftSchema).max(20),
});

export const getMenuWeekRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({
    startsOn: isoDateSchema.optional(),
  }),
});

export const saveMenuWeekDraftRequestSchema = z
  .object({
    body: z.object({ days: z.array(menuDayDraftSchema).length(7) }),
    params: z.object({ startsOn: isoDateSchema }),
    query: z.object({}),
  })
  .superRefine((request, context) => {
    const start = parseUtcDate(request.params.startsOn);
    if (start.getUTCDay() !== 1) {
      context.addIssue({
        code: "custom",
        path: ["params", "startsOn"],
        message: "La semana debe comenzar un lunes",
      });
    }

    const allowedDates = new Set(
      Array.from({ length: 7 }, (_, offset) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + offset);
        return date.toISOString().slice(0, 10);
      }),
    );
    const providedDates = new Set(request.body.days.map((day) => day.serviceDate));
    if (
      providedDates.size !== 7 ||
      [...providedDates].some((date) => !allowedDates.has(date))
    ) {
      context.addIssue({
        code: "custom",
        path: ["body", "days"],
        message: "Debes enviar los siete días consecutivos de la semana",
      });
    }

    request.body.days.forEach((day, index) => {
      if (!day.disabled && day.options.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["body", "days", index, "options"],
          message: "Un día con servicio necesita al menos una alternativa",
        });
      }
      if (day.options.filter((option) => option.trainingMenu).length > 1) {
        context.addIssue({
          code: "custom",
          path: ["body", "days", index, "options"],
          message: "Sólo puede existir un menú de capacitación por día",
        });
      }
    });
  });

export const publishMenuWeekRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ weekId: uuidSchema }),
  query: z.object({}),
});

export type GetMenuWeekRequest = z.infer<typeof getMenuWeekRequestSchema>;
export type SaveMenuWeekDraftRequest = z.infer<typeof saveMenuWeekDraftRequestSchema>;
export type PublishMenuWeekRequest = z.infer<typeof publishMenuWeekRequestSchema>;

function parseUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}
