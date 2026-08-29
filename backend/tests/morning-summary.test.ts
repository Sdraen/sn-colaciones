import { describe, expect, it } from "vitest";
import {
  buildMorningSummaryMessage,
  summarizeOrders,
} from "../src/services/morning-summary.service.js";

describe("resumen de pedidos de la mañana", () => {
  it("suma cantidades y conserva el origen", () => {
    const result = summarizeOrders([
      { kind: "regular", quantity: 2 },
      { kind: "training", quantity: 30 },
      { kind: "extra", quantity: 1 },
      { kind: "exceptional", quantity: 1 },
    ]);

    expect(result).toEqual({
      regular: 2,
      training: 30,
      extra: 1,
      exceptional: 1,
      total: 34,
    });
    expect(buildMorningSummaryMessage(result)).toContain("34 colaciones confirmadas");
  });
});
