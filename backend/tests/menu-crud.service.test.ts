import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createMenuWeekDraft,
  deleteMenuWeekDraft,
  getMenuWeek,
  publishMenuWeek,
  upsertTrainingMenu,
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
            dessert: null,
            beverage: null,
            notes: null,
            capacity: null,
            trainingMenu: true,
            availableForWorkers: true,
            visible: true,
            sortOrder: 0,
          },
        ],
}));

describe("CRUD de borradores semanales", () => {
  it("entrega a Securitas el menú de capacitación con su disponibilidad real", async () => {
    const week = {
      id: "11111111-1111-4111-8111-111111111111",
      organization_id: "22222222-2222-4222-8222-222222222222",
      starts_on: "2026-09-14",
      published_at: "2026-09-12T12:00:00.000Z",
    };
    const day = {
      id: "33333333-3333-4333-8333-333333333333",
      service_date: "2026-09-15",
      phase: "preorder",
      preorder_deadline: "2026-09-14T22:00:00.000Z",
      same_day_opens_at: "2026-09-15T08:00:00.000Z",
      same_day_closes_at: "2026-09-15T11:00:00.000Z",
      delivery_closes_at: "2026-09-15T13:00:00.000Z",
      availability_published_at: null,
      disabled: false,
    };
    const trainingOption = {
      id: "44444444-4444-4444-8444-444444444444",
      service_day_id: day.id,
      category: "especial" as const,
      label: "Menú capacitación",
      description: "Espirales con salsa",
      dessert: null,
      beverage: null,
      notes: null,
      capacity: 35,
      capacity_updated_at: "2026-09-14T12:00:00.000Z",
      available_for_training: true,
      available_for_workers: false,
      visible: true,
      sort_order: 99,
    };
    const weekQuery = {
      not: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: week, error: null }),
    };
    weekQuery.not.mockReturnValue(weekQuery);
    const optionResult = { data: [trainingOption], error: null };
    const optionQuery = {
      eq: vi.fn(),
      then: (
        resolve: (value: typeof optionResult) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(optionResult).then(resolve, reject),
    };
    optionQuery.eq.mockReturnValue(optionQuery);
    const from = vi.fn((table: string) => {
      if (table === "menu_weeks") {
        return { select: () => ({ order: () => ({ limit: () => weekQuery }) }) };
      }
      if (table === "service_days") {
        return {
          select: () => ({
            eq: () => ({ order: vi.fn().mockResolvedValue({ data: [day], error: null }) }),
          }),
        };
      }
      return { select: () => ({ in: () => ({ order: () => optionQuery }) }) };
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          menu_option_id: trainingOption.id,
          reserved_quantity: 15,
          remaining_quantity: 20,
        },
      ],
      error: null,
    });
    const client = { from, rpc } as unknown as UserDatabaseClient;

    const menu = await getMenuWeek(client, {
      includeDrafts: false,
      includeAvailability: true,
    });

    expect(menu.days[0]?.options[0]).toMatchObject({
      trainingMenu: true,
      availableForWorkers: false,
      capacity: 35,
      reservedQuantity: 15,
      remainingQuantity: 20,
    });
    expect(optionQuery.eq).toHaveBeenCalledOnce();
    expect(optionQuery.eq).toHaveBeenCalledWith("visible", true);
    expect(rpc).toHaveBeenCalledWith("get_menu_option_availability", {
      target_menu_week_id: week.id,
    });
  });

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

  it("deriva una semana publicada a la corrección controlada", async () => {
    const { client, rpc } = menuWeekClient({
      id: "11111111-1111-4111-8111-111111111111",
      starts_on: "2026-08-31",
      published_at: "2026-08-28T12:00:00.000Z",
    });
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "MENU_EDIT_CONFIRMATION_REQUIRED",
        details: null,
        hint: null,
      },
    });

    await expect(
      updateMenuWeekDraft(client, {
        menuWeekId: "11111111-1111-4111-8111-111111111111",
        startsOn: "2026-08-31",
        days: draftDays,
      }),
    ).rejects.toMatchObject({ code: "MENU_EDIT_CONFIRMATION_REQUIRED", statusCode: 409 });
    expect(rpc).toHaveBeenCalledWith(
      "update_published_menu_week",
      expect.objectContaining({
        target_menu_week_id: "11111111-1111-4111-8111-111111111111",
        confirm_impact: false,
      }),
    );
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

  it("usa la operación aislada para capacitación sin reemplazar la semana publicada", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "MENU_WEEK_NOT_FOUND",
        details: null,
        hint: null,
      },
    });
    const client = { rpc } as unknown as UserDatabaseClient;

    await expect(
      upsertTrainingMenu(client, {
        menuWeekId: "11111111-1111-4111-8111-111111111111",
        description: "Pollo al jugo con arroz",
        capacity: 35,
      }),
    ).rejects.toMatchObject({ code: "MENU_WEEK_NOT_FOUND", statusCode: 404 });
    expect(rpc).toHaveBeenCalledWith("set_training_menu_for_week", {
      target_menu_week_id: "11111111-1111-4111-8111-111111111111",
      preparation: "Pollo al jugo con arroz",
      informed_capacity: 35,
    });
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
