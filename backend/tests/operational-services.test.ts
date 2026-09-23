import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createExtraOrder,
  createExtraBatch,
  createExceptionalRequest,
  createTrainingOrder,
  createTrainingBatch,
  deleteCompanyExtraRequest,
  deleteCompanyOperationalOrder,
  updateCompanyExtraRequest,
  updateCompanyOperationalOrder,
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
  training_package: true,
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
  quantity: 3,
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
  it("envía varias preparaciones extra en una sola RPC", async () => {
    const { rpc, client } = clientWithRpc({ outcome: "confirmed", items: [] });
    const items = [
      { menuOptionId: orderRow.menu_option_id, quantity: 4 },
      { menuOptionId: "33333333-3333-4333-8333-333333333333", quantity: 3 },
    ];
    const result = await createExtraBatch(client, {
      serviceDayId: orderRow.service_day_id,
      beneficiaryLabel: "Visita externa",
      side: "fruta",
      bread: true,
      tea: false,
      items,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_company_extra_batch", expect.objectContaining({
      requested_items: items,
    }));
    expect(result).toMatchObject({ outcome: "confirmed" });
  });

  it("envía varias preparaciones de capacitación en una sola RPC", async () => {
    const { rpc, client } = clientWithRpc([orderRow]);
    const items = [{ menuOptionId: orderRow.menu_option_id, quantity: 25 }];
    const result = await createTrainingBatch(client, {
      serviceDayId: orderRow.service_day_id,
      name: "Guardias nuevos",
      tea: true,
      items,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_company_training_batch", expect.objectContaining({
      requested_items: items,
      include_tea: true,
    }));
    expect(result).toMatchObject([{ quantity: 30, trainingPackage: true }]);
  });

  it("envía cantidad de colaciones extra a la RPC que valida el cupo", async () => {
    const extraOrder = { ...orderRow, kind: "extra" as const, quantity: 4, training_session_id: null };
    const rpc = vi.fn().mockResolvedValue({ data: extraOrder, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        same_day_closes_at: new Date(Date.now() + 60_000).toISOString(),
        delivery_closes_at: new Date(Date.now() + 120_000).toISOString(),
      },
      error: null,
    });
    const client = {
      rpc,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    } as unknown as UserDatabaseClient;

    const result = await createExtraOrder(client, {
      serviceDayId: orderRow.service_day_id,
      menuOptionId: orderRow.menu_option_id,
      beneficiaryLabel: "Visita externa",
      quantity: 4,
      side: "fruta",
      bread: true,
      tea: false,
    });

    expect(rpc).toHaveBeenCalledWith("create_extra_order_with_quantity", {
      target_service_day_id: orderRow.service_day_id,
      target_menu_option_id: orderRow.menu_option_id,
      beneficiary_name: "Visita externa",
      requested_quantity: 4,
      selected_side: "fruta",
      include_bread: true,
      include_tea: false,
    });
    expect(result).toMatchObject({ outcome: "confirmed", order: { quantity: 4 } });
  });

  it("delega capacitación y pedido grupal a una sola RPC", async () => {
    const { rpc, client } = clientWithRpc(orderRow);

    const result = await createTrainingOrder(client, {
      serviceDayId: orderRow.service_day_id,
      menuOptionId: orderRow.menu_option_id,
      name: "Inducción agosto",
      attendeeCount: 30,
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
    expect(result).toMatchObject({ kind: "training", quantity: 30, trainingPackage: true });
  });

  it("conserva la selección de comida en la solicitud extraordinaria", async () => {
    const { rpc, client } = clientWithRpc(exceptionRow);

    const result = await createExceptionalRequest(client, {
      serviceDayId: exceptionRow.service_day_id,
      menuOptionId: exceptionRow.menu_option_id,
      beneficiaryLabel: exceptionRow.beneficiary_label,
      reason: exceptionRow.reason,
      quantity: 3,
      side: "postre",
      bread: false,
      tea: true,
    });

    expect(rpc).toHaveBeenCalledWith("request_exceptional_order_with_quantity", {
      target_service_day_id: exceptionRow.service_day_id,
      target_menu_option_id: exceptionRow.menu_option_id,
      beneficiary_name: exceptionRow.beneficiary_label,
      request_reason: exceptionRow.reason,
      requested_quantity: 3,
      selected_side: "postre",
      include_bread: false,
      include_tea: true,
    });
    expect(result).toMatchObject({ status: "pending", quantity: 3, side: "postre", tea: true });
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
      requestId: exceptionRow.id,
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

  it("actualiza capacitación y pedido mediante una sola RPC", async () => {
    const updated = { ...orderRow, beneficiary_label: "Curso corregido", quantity: 22 };
    const { rpc, client } = clientWithRpc(updated);

    const result = await updateCompanyOperationalOrder(client, {
      orderId: orderRow.id,
      menuOptionId: orderRow.menu_option_id,
      name: "Curso corregido",
      attendeeCount: 22,
      quantity: 22,
      side: "fruta",
      bread: false,
      tea: true,
    });

    expect(rpc).toHaveBeenCalledWith("update_company_operational_order_with_quantity", {
      target_order_id: orderRow.id,
      target_menu_option_id: orderRow.menu_option_id,
      record_name: "Curso corregido",
      attendee_count: 22,
      requested_quantity: 22,
      selected_side: "fruta",
      include_bread: false,
      include_tea: true,
    });
    expect(result).toMatchObject({ beneficiaryLabel: "Curso corregido", quantity: 22 });
  });

  it("actualiza una solicitud tardía pendiente mediante RPC", async () => {
    const updated = { ...exceptionRow, beneficiary_label: "Visita corregida" };
    const { rpc, client } = clientWithRpc(updated);

    const result = await updateCompanyExtraRequest(client, {
      requestId: exceptionRow.id,
      menuOptionId: exceptionRow.menu_option_id,
      beneficiaryLabel: "Visita corregida",
      reason: "Reunión extraordinaria",
      quantity: 5,
      side: "ensalada",
      bread: true,
      tea: false,
    });

    expect(rpc).toHaveBeenCalledWith("update_company_extra_request_with_quantity", {
      target_request_id: exceptionRow.id,
      target_menu_option_id: exceptionRow.menu_option_id,
      beneficiary_name: "Visita corregida",
      request_reason: "Reunión extraordinaria",
      requested_quantity: 5,
      selected_side: "ensalada",
      include_bread: true,
      include_tea: false,
    });
    expect(result.beneficiaryLabel).toBe("Visita corregida");
  });

  it("elimina pedidos y solicitudes mediante RPC protegidas", async () => {
    const orderDelete = clientWithRpc({ orderId: orderRow.id });
    const requestDelete = clientWithRpc({ requestId: exceptionRow.id });

    await deleteCompanyOperationalOrder(orderDelete.client, orderRow.id);
    await deleteCompanyExtraRequest(requestDelete.client, exceptionRow.id);

    expect(orderDelete.rpc).toHaveBeenCalledWith("delete_company_operational_order", {
      target_order_id: orderRow.id,
    });
    expect(requestDelete.rpc).toHaveBeenCalledWith("delete_company_extra_request", {
      target_request_id: exceptionRow.id,
    });
  });
});
