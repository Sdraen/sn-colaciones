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
  description: z.string().trim().max(300),
  dessert: z.string().trim().max(160).nullable().default(null),
  beverage: z.string().trim().max(160).nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
  capacity: z.number().int().min(0).max(10_000).nullable().default(null),
  trainingMenu: z.boolean().default(false),
  availableForWorkers: z.boolean().default(true),
  visible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

const menuDayDraftSchema = z.object({
  serviceDate: isoDateSchema,
  disabled: z.boolean().default(false),
  options: z.array(menuOptionDraftSchema).max(20),
});

const menuWeekDraftBodySchema = z.object({
  startsOn: isoDateSchema,
  days: z.array(menuDayDraftSchema).length(7),
});

export const getMenuWeekRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({}),
  query: z.object({ startsOn: isoDateSchema.optional() }),
});

export const createMenuWeekRequestSchema = validateMenuWeekDraft(
  z.object({
    body: menuWeekDraftBodySchema,
    params: z.object({}),
    query: z.object({}),
  }),
);

export const updateMenuWeekRequestSchema = validateMenuWeekDraft(
  z.object({
    body: menuWeekDraftBodySchema,
    params: z.object({ weekId: uuidSchema }),
    query: z.object({}),
  }),
);

export const deleteMenuWeekRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ weekId: uuidSchema }),
  query: z.object({}),
});

export const copyMenuWeekRequestSchema = z.object({
  body: z.object({ targetStartsOn: isoDateSchema }).superRefine((body, context) => {
    if (parseUtcDate(body.targetStartsOn).getUTCDay() !== 1) {
      context.addIssue({
        code: "custom",
        path: ["targetStartsOn"],
        message: "La semana debe comenzar un lunes",
      });
    }
  }),
  params: z.object({}),
  query: z.object({}),
});

export const publishMenuWeekRequestSchema = z.object({
  body: z.unknown(),
  params: z.object({ weekId: uuidSchema }),
  query: z.object({}),
});

export type GetMenuWeekRequest = z.infer<typeof getMenuWeekRequestSchema>;
export type CreateMenuWeekRequest = z.infer<typeof createMenuWeekRequestSchema>;
export type UpdateMenuWeekRequest = z.infer<typeof updateMenuWeekRequestSchema>;
export type DeleteMenuWeekRequest = z.infer<typeof deleteMenuWeekRequestSchema>;
export type CopyMenuWeekRequest = z.infer<typeof copyMenuWeekRequestSchema>;
export type PublishMenuWeekRequest = z.infer<typeof publishMenuWeekRequestSchema>;

function validateMenuWeekDraft<Schema extends z.ZodType>(schema: Schema) {
  return schema.superRefine((request, context) => {
    const body = (request as { body: z.infer<typeof menuWeekDraftBodySchema> }).body;
    const startsOn = body.startsOn;
    const start = parseUtcDate(startsOn);
    if (start.getUTCDay() !== 1) {
      context.addIssue({
        code: "custom",
        path: ["body", "startsOn"],
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
    const days = body.days;
    const providedDates = new Set(days.map((day) => day.serviceDate));
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

    days.forEach((day, index) => {
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
          message: "Solo puede existir un menú de capacitación por día",
        });
      }
    });
  });
}

function parseUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}
