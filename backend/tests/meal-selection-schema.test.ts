import { describe, expect, it } from "vitest";
import { saveRegularOrderRequestSchema } from "../src/schemas/order.schema.js";
import { createSpecialMealRequestSchema } from "../src/schemas/company.schema.js";

const request = {
  body: {
    serviceDayId: "00000000-0000-4000-8000-000000000001",
    menuOptionId: "00000000-0000-4000-8000-000000000002",
    side: "ensalada" as const,
    bread: true,
    tea: false,
  },
  params: {},
  query: {},
};

describe("selección de pan y té", () => {
  it("acepta exactamente una alternativa", () => {
    expect(saveRegularOrderRequestSchema.safeParse(request).success).toBe(true);
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, bread: false, tea: true },
      }).success,
    ).toBe(true);
  });

  it("rechaza seleccionar ambas alternativas o ninguna", () => {
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, bread: true, tea: true },
      }).success,
    ).toBe(false);
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, bread: false, tea: false },
      }).success,
    ).toBe(false);
  });

  it("acepta fruta o postre y rechaza la opción sin acompañamiento", () => {
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, side: "fruta" },
      }).success,
    ).toBe(true);
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, side: "ninguno" },
      }).success,
    ).toBe(false);
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, side: "postre" },
      }).success,
    ).toBe(true);
  });
});

describe("solicitud de colación especial", () => {
  const specialRequest = {
    body: {
      serviceDayId: "00000000-0000-4000-8000-000000000001",
      beneficiaryLabel: "Gerente general",
      quantity: 1,
      preparation: "Salmón con verduras",
      reason: "Solicitud de gerencia",
    },
    params: {},
    query: {},
  };

  it("acepta beneficiario, cantidad, preparación y motivo", () => {
    expect(createSpecialMealRequestSchema.safeParse(specialRequest).success).toBe(true);
  });

  it("rechaza cantidad y textos fuera de rango", () => {
    expect(createSpecialMealRequestSchema.safeParse({
      ...specialRequest,
      body: { ...specialRequest.body, quantity: 0 },
    }).success).toBe(false);
    expect(createSpecialMealRequestSchema.safeParse({
      ...specialRequest,
      body: { ...specialRequest.body, preparation: "" },
    }).success).toBe(false);
    expect(createSpecialMealRequestSchema.safeParse({
      ...specialRequest,
      body: { ...specialRequest.body, reason: "no" },
    }).success).toBe(false);
  });
});
