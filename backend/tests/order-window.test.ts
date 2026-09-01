import { describe, expect, it } from "vitest";
import {
  getOrderWindow,
  isTrainingDateAllowed,
  isTrainingWindowOpen,
} from "../src/services/order-window.service.js";

describe("reglas horarias de colaciones", () => {
  const serviceDate = "2026-08-26";

  it("permite reservar anticipadamente hasta las 22:00 del día anterior", () => {
    expect(getOrderWindow(serviceDate, new Date("2026-08-25T21:59:00-04:00"))).toBe(
      "preorder_open",
    );
    expect(getOrderWindow(serviceDate, new Date("2026-08-25T22:01:00-04:00"))).toBe(
      "waiting_same_day",
    );
  });

  it("separa extras directos y extras con aprobación hasta las 13:00", () => {
    expect(getOrderWindow(serviceDate, new Date("2026-08-26T08:30:00-04:00"))).toBe(
      "same_day_open",
    );
    expect(getOrderWindow(serviceDate, new Date("2026-08-26T11:30:00-04:00"))).toBe(
      "exceptional_open",
    );
    expect(getOrderWindow(serviceDate, new Date("2026-08-26T12:59:00-04:00"))).toBe(
      "exceptional_open",
    );
    expect(getOrderWindow(serviceDate, new Date("2026-08-26T13:00:00-04:00"))).toBe(
      "closed",
    );
  });

  it("permite capacitaciones actuales o futuras hasta las 09:00 y desde las 14:00", () => {
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-26T08:59:00-04:00")),
    ).toBe(true);
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-26T09:01:00-04:00")),
    ).toBe(false);
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-26T14:00:00-04:00")),
    ).toBe(true);
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-25T08:00:00-04:00")),
    ).toBe(true);
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-25T10:00:00-04:00")),
    ).toBe(false);
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-25T14:00:00-04:00")),
    ).toBe(true);
    expect(
      isTrainingWindowOpen(serviceDate, new Date("2026-08-27T08:00:00-04:00")),
    ).toBe(false);
  });

  it("solo permite capacitaciones en días hábiles no bloqueados", () => {
    expect(isTrainingDateAllowed("2026-08-24")).toBe(true);
    expect(isTrainingDateAllowed("2026-08-29")).toBe(false);
    expect(isTrainingDateAllowed("2026-08-24", true)).toBe(false);
  });
});
