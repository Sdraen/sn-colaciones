import { describe, expect, it } from "vitest";
import { updateAvailabilityRequestSchema } from "../src/schemas/provider.schema.js";

const menuOptionId = "11111111-1111-4111-8111-111111111111";

describe("ajuste operativo de cupo", () => {
  it("acepta un cupo total entero", () => {
    const result = updateAvailabilityRequestSchema.safeParse({
      body: { capacity: 50 },
      params: { menuOptionId },
      query: {},
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un cupo vacío, negativo o decimal", () => {
    for (const capacity of [null, -1, 10.5]) {
      const result = updateAvailabilityRequestSchema.safeParse({
        body: { capacity },
        params: { menuOptionId },
        query: {},
      });

      expect(result.success).toBe(false);
    }
  });
});
