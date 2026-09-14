import { describe, expect, it } from "vitest";
import {
  deleteExtraRequestRequestSchema,
  deleteOperationalOrderRequestSchema,
  updateExtraRequestRequestSchema,
  updateOperationalOrderRequestSchema,
} from "../src/schemas/company.schema.js";

const validId = "11111111-1111-4111-8111-111111111111";
const validOptionId = "22222222-2222-4222-8222-222222222222";

describe("correcciones operacionales de Securitas", () => {
  it("acepta la edición de una capacitación o extra con selección completa", () => {
    const result = updateOperationalOrderRequestSchema.safeParse({
      body: {
        menuOptionId: validOptionId,
        name: "Inducción guardias",
        attendeeCount: 24,
        side: "ensalada",
        bread: true,
        tea: false,
      },
      params: { orderId: validId },
      query: {},
    });

    expect(result.success).toBe(true);
  });

  it("rechaza pan y té simultáneos en una corrección", () => {
    const result = updateOperationalOrderRequestSchema.safeParse({
      body: {
        menuOptionId: validOptionId,
        name: "Visita externa",
        attendeeCount: null,
        side: "fruta",
        bread: true,
        tea: true,
      },
      params: { orderId: validId },
      query: {},
    });

    expect(result.success).toBe(false);
  });

  it("exige motivo al modificar una solicitud tardía", () => {
    const result = updateExtraRequestRequestSchema.safeParse({
      body: {
        menuOptionId: validOptionId,
        beneficiaryLabel: "Visita externa",
        reason: "",
        side: "fruta",
        bread: false,
        tea: true,
      },
      params: { requestId: validId },
      query: {},
    });

    expect(result.success).toBe(false);
  });

  it("valida los identificadores al eliminar", () => {
    expect(
      deleteOperationalOrderRequestSchema.safeParse({
        body: undefined,
        params: { orderId: validId },
        query: {},
      }).success,
    ).toBe(true);
    expect(
      deleteExtraRequestRequestSchema.safeParse({
        body: undefined,
        params: { requestId: "invalido" },
        query: {},
      }).success,
    ).toBe(false);
  });
});
