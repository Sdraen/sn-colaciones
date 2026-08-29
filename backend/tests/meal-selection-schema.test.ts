import { describe, expect, it } from "vitest";
import { saveRegularOrderRequestSchema } from "../src/schemas/order.schema.js";

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

describe("selección de pan o té", () => {
  it("acepta exactamente una alternativa", () => {
    expect(saveRegularOrderRequestSchema.safeParse(request).success).toBe(true);
    expect(
      saveRegularOrderRequestSchema.safeParse({
        ...request,
        body: { ...request.body, bread: false, tea: true },
      }).success,
    ).toBe(true);
  });

  it("rechaza seleccionar ambas o ninguna", () => {
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
});
