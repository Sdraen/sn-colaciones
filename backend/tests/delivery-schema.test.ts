import { describe, expect, it } from "vitest";
import {
  confirmServiceReceiptRequestSchema,
  recordDeliveryEventRequestSchema,
} from "../src/schemas/delivery.schema.js";

const serviceDayId = "00000000-0000-4000-8000-000000000001";

describe("contratos de seguimiento de despacho", () => {
  it("acepta únicamente llegada o término de entrega", () => {
    expect(recordDeliveryEventRequestSchema.safeParse({
      body: { event: "arrived" },
      params: { serviceDayId },
      query: {},
    }).success).toBe(true);
    expect(recordDeliveryEventRequestSchema.safeParse({
      body: { event: "receipt" },
      params: { serviceDayId },
      query: {},
    }).success).toBe(false);
  });

  it("exige una confirmación explícita de Securitas", () => {
    expect(confirmServiceReceiptRequestSchema.safeParse({
      body: { confirmed: true },
      params: { serviceDayId },
      query: {},
    }).success).toBe(true);
    expect(confirmServiceReceiptRequestSchema.safeParse({
      body: { confirmed: false },
      params: { serviceDayId },
      query: {},
    }).success).toBe(false);
  });
});
