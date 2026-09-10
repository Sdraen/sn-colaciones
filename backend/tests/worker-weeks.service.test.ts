import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { listAvailableWorkerMenuWeeks } from "../src/services/order.service.js";
import type { Database } from "../src/types/database.js";

describe("semanas disponibles para trabajadores", () => {
  it("lista en orden solo semanas publicadas desde la semana vigente", async () => {
    const rows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        starts_on: "2026-09-07",
        published_at: "2026-09-06T18:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        starts_on: "2026-09-14",
        published_at: "2026-09-10T18:00:00.000Z",
      },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const not = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ not });
    const select = vi.fn().mockReturnValue({ gte });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient<Database>;

    const result = await listAvailableWorkerMenuWeeks(client, "2026-09-07");

    expect(from).toHaveBeenCalledWith("menu_weeks");
    expect(gte).toHaveBeenCalledWith("starts_on", "2026-09-07");
    expect(not).toHaveBeenCalledWith("published_at", "is", null);
    expect(order).toHaveBeenCalledWith("starts_on", { ascending: true });
    expect(result).toEqual([
      {
        id: rows[0]!.id,
        startsOn: "2026-09-07",
        publishedAt: rows[0]!.published_at,
      },
      {
        id: rows[1]!.id,
        startsOn: "2026-09-14",
        publishedAt: rows[1]!.published_at,
      },
    ]);
  });
});
