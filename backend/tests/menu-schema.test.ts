import { describe, expect, it } from "vitest";
import {
  copyMenuWeekRequestSchema,
  createMenuWeekRequestSchema,
  deleteMenuWeekRequestSchema,
  updateTrainingMenuRequestSchema,
  updateDailyTrainingMenusRequestSchema,
  updateMenuWeekRequestSchema,
} from "../src/schemas/menu.schema.js";

function weeklyDraft(startsOn = "2026-08-24") {
  const start = new Date(`${startsOn}T00:00:00.000Z`);
  return {
    body: {
      startsOn,
      days: Array.from({ length: 7 }, (_, offset) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + offset);
        return {
          serviceDate: date.toISOString().slice(0, 10),
          disabled: false,
          options: [
            {
              id: undefined as string | undefined,
              category: "principal" as const,
              label: "Menú principal",
              description: "Pollo al jugo con arroz",
              trainingMenu: false,
            },
          ],
        };
      }),
    },
    params: {},
    query: {},
  };
}

describe("contrato del menú semanal", () => {
  it("acepta siete días consecutivos desde un lunes", () => {
    const result = createMenuWeekRequestSchema.safeParse(weeklyDraft());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.days[0]?.options[0]).toMatchObject({
        capacity: null,
        trainingMenu: false,
        visible: true,
        sortOrder: 0,
      });
      expect(result.data.body.days[0]?.dessert).toBeNull();
    }
  });

  it("acepta postre diario con tipo y cupo propio", () => {
    const input = weeklyDraft();
    Object.assign(input.body.days[1]!, {
      dessert: { name: "Leche asada", capacity: 25 },
    });

    const result = createMenuWeekRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.days[1]?.dessert).toEqual({
        name: "Leche asada",
        capacity: 25,
      });
    }
  });

  it("rechaza postre diario sin nombre o sin cupo", () => {
    const input = weeklyDraft();
    Object.assign(input.body.days[1]!, {
      dessert: { name: " ", capacity: 25 },
    });

    expect(createMenuWeekRequestSchema.safeParse(input).success).toBe(false);
  });

  it("permite guardar preparaciones pendientes como borrador", () => {
    const input = weeklyDraft();
    input.body.days[0]!.options[0]!.description = "";

    const result = createMenuWeekRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it("rechaza una semana que no comienza un lunes", () => {
    const result = createMenuWeekRequestSchema.safeParse(weeklyDraft("2026-08-25"));

    expect(result.success).toBe(false);
  });

  it("rechaza días habilitados sin alternativas", () => {
    const input = weeklyDraft();
    input.body.days[2]!.options = [];

    const result = createMenuWeekRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("permite más de un menú de capacitación en el mismo día", () => {
    const input = weeklyDraft();
    input.body.days[0]!.options = [
      { ...input.body.days[0]!.options[0]!, trainingMenu: true },
      {
        id: undefined,
        category: "principal",
        label: "Menú vegetariano",
        description: "Guiso de lentejas",
        trainingMenu: true,
      },
    ];

    const result = createMenuWeekRequestSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it("valida las preparaciones de capacitación por día", () => {
    const valid = updateDailyTrainingMenusRequestSchema.safeParse({
      body: { options: [
        { label: "Principal", description: "Pollo con arroz", capacity: 30 },
        { label: "Hipocalórico", description: "Ensalada con pollo", capacity: 15 },
      ] },
      params: { serviceDayId: "11111111-1111-4111-8111-111111111111" },
      query: {},
    });
    expect(valid.success).toBe(true);
    expect(updateDailyTrainingMenusRequestSchema.safeParse({
      ...valid.data,
      body: { options: [{ label: "M", description: "", capacity: -1 }] },
    }).success).toBe(false);
  });

  it("valida el identificador al editar o eliminar", () => {
    const updateInput = weeklyDraft();
    const invalidUpdate = updateMenuWeekRequestSchema.safeParse({
      ...updateInput,
      params: { weekId: "semana-invalida" },
    });
    const validDelete = deleteMenuWeekRequestSchema.safeParse({
      body: undefined,
      params: { weekId: "11111111-1111-4111-8111-111111111111" },
      query: {},
    });

    expect(invalidUpdate.success).toBe(false);
    expect(validDelete.success).toBe(true);
  });

  it("acepta identificadores existentes y confirmación de impacto al editar", () => {
    const input = weeklyDraft();
    input.body.days[0]!.options[0] = {
      ...input.body.days[0]!.options[0]!,
      id: "44444444-4444-4444-8444-444444444444",
    };

    const result = updateMenuWeekRequestSchema.safeParse({
      ...input,
      body: { ...input.body, confirmImpact: true },
      params: { weekId: "11111111-1111-4111-8111-111111111111" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.confirmImpact).toBe(true);
      expect(result.data.body.days[0]?.options[0]?.id).toBe(
        "44444444-4444-4444-8444-444444444444",
      );
    }
  });

  it("solo permite copiar hacia una semana que comienza un lunes", () => {
    const monday = copyMenuWeekRequestSchema.safeParse({
      body: { targetStartsOn: "2026-08-31" },
      params: {},
      query: {},
    });
    const tuesday = copyMenuWeekRequestSchema.safeParse({
      body: { targetStartsOn: "2026-09-01" },
      params: {},
      query: {},
    });

    expect(monday.success).toBe(true);
    expect(tuesday.success).toBe(false);
  });

  it("valida el menú de capacitación agregado después de publicar", () => {
    const valid = updateTrainingMenuRequestSchema.safeParse({
      body: { description: "Pollo al jugo con arroz", capacity: 35 },
      params: { weekId: "11111111-1111-4111-8111-111111111111" },
      query: {},
    });
    const invalid = updateTrainingMenuRequestSchema.safeParse({
      body: { description: "  ", capacity: -1 },
      params: { weekId: "11111111-1111-4111-8111-111111111111" },
      query: {},
    });
    const withoutCapacity = updateTrainingMenuRequestSchema.safeParse({
      body: { description: "Pollo al jugo con arroz", capacity: null },
      params: { weekId: "11111111-1111-4111-8111-111111111111" },
      query: {},
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
    expect(withoutCapacity.success).toBe(false);
  });
});
