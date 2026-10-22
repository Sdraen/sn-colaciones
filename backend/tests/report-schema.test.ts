import { describe, expect, it } from "vitest";
import { reportRequestSchema } from "../src/schemas/report.schema.js";

describe("filtros del reporte", () => {
  it("acepta una empresa y normaliza sus espacios", () => {
    const result = reportRequestSchema.parse({
      body: undefined,
      params: {},
      query: {
        period: "weekly",
        date: "2026-10-22",
        company: "  Empresa Contratista  ",
      },
    });

    expect(result.query.company).toBe("Empresa Contratista");
  });

  it("rechaza nombres de empresa vacíos", () => {
    expect(() =>
      reportRequestSchema.parse({
        body: undefined,
        params: {},
        query: { company: " " },
      }),
    ).toThrow();
  });
});
