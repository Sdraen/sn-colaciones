import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createExceptionalRequest,
  createTrainingOrder,
} from "../src/services/company.service.js";
import { resolveExceptionalRequest } from "../src/services/provider.service.js";
import type { Database } from "../src/types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;

const orderRow: Database["public"]["Tables"]["orders"]["Row"] = {
  id: "00000000-0000-4000-8000-000000000010",
  service_day_id: "00000000-0000-4000-8000-000000000001",
  menu_option_id: "00000000-0000-4000-8000-000000000002",
  diner_id: null,
  training_session_id: "00000000-0000-4000-8000-000000000003",
  exception_request_id: null,
  created_by: "00000000-0000-4000-8000-000000000004",
  kind: "training",
  beneficiary_label: "Inducción agosto",
  quantity: 30,
  side: "ensalada",
  bread: true,
  tea: false,
  status: "confirmed",
  fulfilled_at: null,
  created_at: "2026-08-26T12:00:00.000Z",
  updated_at: "2026-08-26T12:00:00.000Z",
};

const exceptionRow: Database["public"]["Tables"]["exception_requests"]["Row"] = {
  id: "00000000-0000-4000-8000-000000000020",
  service_day_id: "00000000-0000-4000-8000-000000000001",
  menu_option_id: "00000000-0000-4000-8000-000000000002",
  beneficiary_label: "Visita externa",
  reason: "Reunión en la empresa",
  side: "postre",
  bread: false,
  tea: true,
  status: "pending",
  requested_by: "00000000-0000-4000-8000-000000000004",
  resolved_by: null,
  resolution_note: null,
  requested_at: "2026-08-26T15:00:00.000Z",
  resolved_at: null,
};

function clientWithRpc(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { rpc, client: { rpc } as unknown as UserDatabaseClient };
}

describe("servicios operacionales atómicos", () => {
  it("delega capacitación y pedido grupal a una sola RPC", async () => {
    const { rpc, client } = clientWithRpc(orderRow);

    const result = await createTrainingOrder(client, {
      serviceDayId: orderRow.service_day_id,
      menuOptionId: orderRow.menu_option_id,
      name: "Inducción agosto",
      attendeeCount: 30,
      side: "ensalada",
      bread: true,
      tea: false,
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_training_order", {
      target_service_day_id: orderRow.service_day_id,
      target_menu_option_id: orderRow.menu_option_id,
      training_name: "Inducción agosto",
      attendee_count: 30,
      selected_side: "ensalada",
      include_bread: true,
      include_tea: false,
    });
    expect(result).toMatchObject({ kind: "training", quantity: 30 });
  });

  it("conserva la selección de comida en la solicitud extraordinaria", async () => {
    const { rpc, client } = clientWithRpc(exceptionRow);

    const result = await createExceptionalRequest(client, {
      serviceDayId: exceptionRow.service_day_id,
      menuOptionId: exceptionRow.menu_option_id,
      beneficiaryLabel: exceptionRow.beneficiary_label,
      reason: exceptionRow.reason,
      side: "postre",
      bread: false,
      tea: true,
    });

    expect(rpc).toHaveBeenCalledWith("request_exceptional_order", {
      target_service_day_id: exceptionRow.service_day_id,
      target_menu_option_id: exceptionRow.menu_option_id,
      beneficiary_name: exceptionRow.beneficiary_label,
      request_reason: exceptionRow.reason,
      selected_side: "postre",
      include_bread: false,
      include_tea: true,
    });
    expect(result).toMatchObject({ status: "pending", side: "postre", tea: true });
  });

  it("envía el motivo al rechazar una solicitud", async () => {
    const resolved = {
      ...exceptionRow,
      status: "rejected" as const,
      resolution_note: "No queda disponibilidad para hoy",
      resolved_at: "2026-08-26T15:10:00.000Z",
    };
    const { rpc, client } = clientWithRpc(resolved);

    const result = await resolveExceptionalRequest(client, {
      exceptionId: exceptionRow.id,
      status: "rejected",
      resolutionNote: "No queda disponibilidad para hoy",
    });

    expect(rpc).toHaveBeenCalledWith("resolve_exception_request", {
      target_exception_id: exceptionRow.id,
      decision: "rejected",
      rejection_note: "No queda disponibilidad para hoy",
    });
    expect(result).toMatchObject({ status: "rejected" });
  });
});
