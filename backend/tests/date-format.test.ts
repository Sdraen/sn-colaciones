import { describe, expect, it } from "vitest";
import { formatIsoDateForChile } from "../src/lib/date-format.js";

describe("formatIsoDateForChile", () => {
  it("presenta una fecha ISO como día/mes/año", () => {
    expect(formatIsoDateForChile("2026-08-29")).toBe("29/08/2026");
  });

  it("no altera fechas inválidas ni timestamps", () => {
    expect(formatIsoDateForChile("2026-02-30")).toBe("2026-02-30");
    expect(formatIsoDateForChile("2026-08-29T12:00:00Z")).toBe(
      "2026-08-29T12:00:00Z",
    );
  });
});
