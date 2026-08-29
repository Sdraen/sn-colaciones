import { describe, expect, it } from "vitest";
import {
  resolveReportRange,
  summarizeReportOrders,
} from "../src/services/report.service.js";

describe("reportes por período", () => {
  it("calcula día, semana y mes hasta la fecha solicitada", () => {
    expect(resolveReportRange("daily", "2026-08-26")).toEqual({
      from: "2026-08-26",
      to: "2026-08-26",
    });
    expect(resolveReportRange("weekly", "2026-08-26")).toEqual({
      from: "2026-08-24",
      to: "2026-08-30",
    });
    expect(resolveReportRange("monthly", "2026-08-26")).toEqual({
      from: "2026-08-01",
      to: "2026-08-26",
    });
  });

  it("suma cantidades y excluye canceladas de producción", () => {
    const totals = summarizeReportOrders([
      {
        service_day_id: "day-1",
        menu_option_id: "menu-1",
        kind: "regular",
        quantity: 1,
        side: "ensalada",
        bread: true,
        tea: false,
        status: "confirmed",
        fulfilled_at: "2026-08-26T16:00:00.000Z",
      },
      {
        service_day_id: "day-1",
        menu_option_id: "menu-1",
        kind: "training",
        quantity: 20,
        side: "postre",
        bread: false,
        tea: true,
        status: "confirmed",
        fulfilled_at: null,
      },
      {
        service_day_id: "day-1",
        menu_option_id: "menu-2",
        kind: "regular",
        quantity: 1,
        side: "ninguno",
        bread: true,
        tea: false,
        status: "cancelled",
        fulfilled_at: null,
      },
    ]);

    expect(totals).toMatchObject({
      requested: 22,
      confirmed: 21,
      cancelled: 1,
      fulfilled: 1,
      bread: 1,
      tea: 20,
      byKind: { regular: 1, training: 20, extra: 0, exceptional: 0 },
    });
  });
});
