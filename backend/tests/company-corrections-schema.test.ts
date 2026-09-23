import { describe, expect, it } from "vitest";
import {
  createExtraRequestSchema,
  createExtraBatchRequestSchema,
  createTrainingRequestSchema,
  createTrainingBatchRequestSchema,
  deleteExtraRequestRequestSchema,
  deleteOperationalOrderRequestSchema,
  updateExtraRequestRequestSchema,
  updateOperationalOrderRequestSchema,
} from "../src/schemas/company.schema.js";

const validId = "11111111-1111-4111-8111-111111111111";
const validOptionId = "22222222-2222-4222-8222-222222222222";

describe("correcciones operacionales de Securitas", () => {
  it("registra capacitación con paquete fijo y té opcional", () => {
    const request = {
      body: {
        serviceDayId: validId,
        menuOptionId: validOptionId,
        name: "Guardias nuevos",
        attendeeCount: 25,
        tea: false,
      },
      params: {},
      query: {},
    };
    expect(createTrainingRequestSchema.safeParse(request).success).toBe(true);
    expect(createTrainingRequestSchema.parse({
      ...request,
      body: { serviceDayId: validId, menuOptionId: validOptionId, name: "Guardias nuevos", attendeeCount: 25 },
    }).body.tea).toBe(false);
    expect(createTrainingRequestSchema.safeParse({
      ...request,
      body: { ...request.body, side: "fruta" },
    }).success).toBe(false);
  });
  it("acepta la edición de una capacitación o extra con selección completa", () => {
    const result = updateOperationalOrderRequestSchema.safeParse({
      body: {
        menuOptionId: validOptionId,
        name: "Inducción guardias",
        attendeeCount: 24,
        quantity: 24,
        side: "ensalada",
        bread: true,
        tea: false,
      },
      params: { orderId: validId },
      query: {},
    });

    expect(result.success).toBe(true);
  });

  it("acepta pan y té simultáneos y rechaza omitir ambos", () => {
    const result = updateOperationalOrderRequestSchema.safeParse({
      body: {
        menuOptionId: validOptionId,
        name: "Visita externa",
        attendeeCount: null,
        quantity: 12,
        side: "fruta",
        bread: true,
        tea: true,
      },
      params: { orderId: validId },
      query: {},
    });

    expect(result.success).toBe(true);
    expect(
      updateOperationalOrderRequestSchema.safeParse({
        body: {
          menuOptionId: validOptionId,
          name: "Visita externa",
          attendeeCount: null,
          quantity: 12,
          side: "fruta",
          bread: false,
          tea: false,
        },
        params: { orderId: validId },
        query: {},
      }).success,
    ).toBe(false);
  });

  it("exige motivo al modificar una solicitud tardía", () => {
    const result = updateExtraRequestRequestSchema.safeParse({
      body: {
        menuOptionId: validOptionId,
        beneficiaryLabel: "Visita externa",
        reason: "",
        quantity: 12,
        side: "fruta",
        bread: false,
        tea: true,
      },
      params: { requestId: validId },
      query: {},
    });

    expect(result.success).toBe(false);
  });

  it("exige una cantidad entera y positiva para colaciones extra", () => {
    const request = {
      body: {
        serviceDayId: validId,
        menuOptionId: validOptionId,
        beneficiaryLabel: "Visita externa",
        quantity: 3,
        side: "fruta",
        bread: true,
        tea: false,
      },
      params: {},
      query: {},
    };
    expect(createExtraRequestSchema.safeParse(request).success).toBe(true);
    for (const quantity of [0, 1.5, 501]) {
      expect(createExtraRequestSchema.safeParse({
        ...request,
        body: { ...request.body, quantity },
      }).success).toBe(false);
    }
  });

  it("acepta varias preparaciones con cupos propios y rechaza duplicados", () => {
    const items = [
      { menuOptionId: validOptionId, quantity: 4 },
      { menuOptionId: "33333333-3333-4333-8333-333333333333", quantity: 3 },
    ];
    const extra = {
      body: {
        serviceDayId: validId,
        beneficiaryLabel: "Visita externa",
        side: "fruta",
        bread: true,
        tea: false,
        items,
      },
      params: {}, query: {},
    };
    const training = {
      body: { serviceDayId: validId, name: "Guardias nuevos", tea: false, items },
      params: {}, query: {},
    };
    expect(createExtraBatchRequestSchema.safeParse(extra).success).toBe(true);
    expect(createTrainingBatchRequestSchema.safeParse(training).success).toBe(true);
    expect(createExtraBatchRequestSchema.safeParse({
      ...extra, body: { ...extra.body, items: [items[0], items[0]] },
    }).success).toBe(false);
    expect(createTrainingBatchRequestSchema.safeParse({
      ...training, body: { ...training.body, items: [{ ...items[0], quantity: 0 }] },
    }).success).toBe(false);
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
