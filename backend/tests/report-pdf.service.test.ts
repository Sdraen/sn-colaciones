import { describe, expect, it } from "vitest";
import { createNominalOrdersPdf } from "../src/services/report-pdf.service.js";
import type { NominalOrdersReport } from "../src/services/report.service.js";

describe("reporte nominal en PDF", () => {
  it("genera un PDF válido con el detalle de la colación", async () => {
    const report = {
      period: "weekly",
      range: { from: "2026-09-14", to: "2026-09-20" },
      totals: {
        requested: 1,
        confirmed: 1,
        cancelled: 0,
        fulfilled: 0,
        byKind: { regular: 1, training: 0, extra: 0, exceptional: 0 },
        sides: { salad: 0, fruit: 1, dessert: 0, none: 0 },
        bread: 1,
        tea: 0,
      },
      rows: [
        {
          orderId: "order-1",
          serviceDate: "2026-09-14",
          beneficiaryName: "María González",
          employeeCode: "SEC-001",
          kind: "regular",
          menuLabel: "Principal 1",
          preparation: "Pollo mongoliano con fideos blancos",
          quantity: 1,
          side: "fruta",
          bread: true,
          tea: false,
          status: "confirmed",
          fulfilled: false,
        },
      ],
      generatedAt: "2026-09-14T15:00:00.000Z",
    } satisfies NominalOrdersReport;

    const pdf = await createNominalOrdersPdf(report);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
