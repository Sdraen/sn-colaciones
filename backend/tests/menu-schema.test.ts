import { describe, expect, it } from "vitest";
import { saveMenuWeekDraftRequestSchema } from "../src/schemas/menu.schema.js";

function weeklyDraft(startsOn = "2026-08-24") {
  const start = new Date(`${startsOn}T00:00:00.000Z`);
  return {
    body: {
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
    params: { startsOn },
    query: {},
  };
}

describe("contrato del menú semanal", () => {
  it("acepta siete días consecutivos desde un lunes", () => {
    const result = saveMenuWeekDraftRequestSchema.safeParse(weeklyDraft());

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

  it("rechaza una semana que no comienza un lunes", () => {
    const result = saveMenuWeekDraftRequestSchema.safeParse(weeklyDraft("2026-08-25"));

    expect(result.success).toBe(false);
  });

  it("rechaza días habilitados sin alternativas", () => {
    const input = weeklyDraft();
    input.body.days[2]!.options = [];

    const result = saveMenuWeekDraftRequestSchema.safeParse(input);

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

    const result = saveMenuWeekDraftRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});
