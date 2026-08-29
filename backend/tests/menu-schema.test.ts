import { describe, expect, it } from "vitest";
import {
  copyMenuWeekRequestSchema,
  createMenuWeekRequestSchema,
  deleteMenuWeekRequestSchema,
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
    }
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

  it("rechaza más de un menú de capacitación en el mismo día", () => {
    const input = weeklyDraft();
    input.body.days[0]!.options = [
      { ...input.body.days[0]!.options[0]!, trainingMenu: true },
      {
        category: "principal",
        label: "Menú vegetariano",
        description: "Guiso de lentejas",
        trainingMenu: true,
      },
    ];

    const result = createMenuWeekRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
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
});
