import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createMenuWeekDraft,
  deleteMenuWeekDraft,
  publishMenuWeek,
  updateMenuWeekDraft,
} from "../src/services/menu.service.js";
import type { Database } from "../src/types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;

const draftDays = Array.from({ length: 7 }, (_, index) => ({
  serviceDate: addDays("2026-08-31", index),
  disabled: index >= 5,
  options:
    index >= 5
      ? []
      : [
          {
            category: "principal" as const,
            label: "Menú principal",
            description: "Pollo al jugo con arroz",
            capacity: null,
            trainingMenu: true,
            visible: true,
            sortOrder: 0,
          },
        ],
}));

describe("CRUD de borradores semanales", () => {
  it("no crea una segunda semana para el mismo lunes", async () => {
    const { client, rpc } = menuWeekClient({
      id: "11111111-1111-4111-8111-111111111111",
      starts_on: "2026-08-31",
      published_at: null,
    });

    await expect(
      createMenuWeekDraft(client, { startsOn: "2026-08-31", days: draftDays }),
    ).rejects.toMatchObject({ code: "MENU_WEEK_ALREADY_EXISTS", statusCode: 409 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("protege una semana publicada contra ediciones", async () => {
    const { client, rpc } = menuWeekClient({
      id: "11111111-1111-4111-8111-111111111111",
      starts_on: "2026-08-31",
      published_at: "2026-08-28T12:00:00.000Z",
    });

    await expect(
      updateMenuWeekDraft(client, {
        menuWeekId: "11111111-1111-4111-8111-111111111111",
        startsOn: "2026-08-31",
        days: draftDays,
      }),
    ).rejects.toMatchObject({ code: "MENU_WEEK_PUBLISHED", statusCode: 409 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elimina un borrador por identificador", async () => {
    const { client, deleteRecord } = menuWeekClient({
      id: "11111111-1111-4111-8111-111111111111",
      starts_on: "2026-08-31",
      published_at: null,
    });

    await deleteMenuWeekDraft(client, "11111111-1111-4111-8111-111111111111");

    expect(deleteRecord).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");
  });

  it("impide publicar si una preparación visible sigue pendiente", async () => {
    const rpc = vi.fn();
    const weekId = "11111111-1111-4111-8111-111111111111";
    const week = {
      id: weekId,
      organization_id: "22222222-2222-4222-8222-222222222222",
      starts_on: "2026-08-31",
      published_at: null,
    };
    const serviceDays = Array.from({ length: 7 }, (_, index) => ({
      id: `33333333-3333-4333-8333-33333333333${index}`,
      service_date: addDays("2026-08-31", index),
      phase: "preorder",
      preorder_deadline: "2026-08-30T22:00:00.000Z",
      same_day_opens_at: "2026-08-31T08:00:00.000Z",
      same_day_closes_at: "2026-08-31T11:00:00.000Z",
      delivery_closes_at: "2026-08-31T14:00:00.000Z",
      availability_published_at: null,
      disabled: index >= 5,
    }));
    const optionRows = serviceDays.slice(0, 5).map((day, index) => ({
      id: `44444444-4444-4444-8444-44444444444${index}`,
      service_day_id: day.id,
      category: "principal" as const,
      label: "Menú principal",
      description: index === 0 ? "" : "Pollo al jugo con arroz",
      capacity: null,
      capacity_updated_at: null,
      available_for_training: true,
      visible: true,
      sort_order: 0,
    }));
    let menuWeekReads = 0;
    const from = vi.fn((table: string) => {
      if (table === "menu_weeks") {
        menuWeekReads += 1;
        if (menuWeekReads === 1) {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: week, error: null }) }),
            }),
          };
        }
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: week, error: null }) }),
              }),
            }),
          }),
        };
      }
      if (table === "service_days") {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({ data: serviceDays, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: () => ({
            order: vi.fn().mockResolvedValue({ data: optionRows, error: null }),
          }),
        }),
      };
    });
    const client = { from, rpc } as unknown as UserDatabaseClient;

    await expect(publishMenuWeek(client, weekId)).rejects.toMatchObject({
      code: "MENU_WEEK_INCOMPLETE",
      statusCode: 422,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

function menuWeekClient(
  record: { id: string; starts_on: string; published_at: string | null } | null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: record, error: null });
  const selectRecord = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectRecord });
  const deleteRecord = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockReturnValue({ eq: deleteRecord });
  const from = vi.fn().mockReturnValue({ select, delete: remove });
  const rpc = vi.fn();

  return {
    client: { from, rpc } as unknown as UserDatabaseClient,
    deleteRecord,
    rpc,
  };
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
