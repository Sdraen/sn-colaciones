import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  confirmCompanyDeliveryArrival,
  confirmServiceReceipt,
  recordDeliveryEvent,
  saveServiceReceiptCheck,
} from "../src/services/delivery.service.js";
import type { Database } from "../src/types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;

const trackingRow: Database["public"]["Tables"]["service_delivery_tracking"]["Row"] = {
  service_day_id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-000000000002",
  arrived_at: "2026-09-03T16:05:00.000Z",
  arrived_by: "00000000-0000-4000-8000-000000000003",
  company_arrival_confirmed_at: null,
  company_arrival_confirmed_by: null,
  delivered_at: null,
  delivered_by: null,
  receipt_confirmed_at: null,
  receipt_confirmed_by: null,
  updated_at: "2026-09-03T16:05:00.000Z",
};

function clientWithRpc(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { rpc, client: { rpc } as unknown as UserDatabaseClient };
}

describe("seguimiento diario de despacho", () => {
  it("registra un evento de delivery mediante la RPC protegida", async () => {
    const { rpc, client } = clientWithRpc(trackingRow);

    const result = await recordDeliveryEvent(client, {
      serviceDayId: trackingRow.service_day_id,
      event: "arrived",
    });

    expect(rpc).toHaveBeenCalledWith("record_delivery_event", {
      target_service_day_id: trackingRow.service_day_id,
      event_name: "arrived",
    });
    expect(result).toMatchObject({
      serviceDayId: trackingRow.service_day_id,
      arrivedAt: trackingRow.arrived_at,
      deliveredAt: null,
    });
  });

  it("confirma la recepción completa mediante la RPC de Securitas", async () => {
    const confirmedRow = {
      ...trackingRow,
      delivered_at: "2026-09-03T16:20:00.000Z",
      delivered_by: trackingRow.arrived_by,
      receipt_confirmed_at: "2026-09-03T16:25:00.000Z",
      receipt_confirmed_by: "00000000-0000-4000-8000-000000000004",
    };
    const { rpc, client } = clientWithRpc(confirmedRow);

    const result = await confirmServiceReceipt(client, trackingRow.service_day_id);

    expect(rpc).toHaveBeenCalledWith("confirm_service_receipt", {
      target_service_day_id: trackingRow.service_day_id,
    });
    expect(result.receiptConfirmedAt).toBe(confirmedRow.receipt_confirmed_at);
  });

  it("registra por separado la confirmación de llegada de Securitas", async () => {
    const companyConfirmedRow = {
      ...trackingRow,
      company_arrival_confirmed_at: "2026-09-03T16:07:00.000Z",
      company_arrival_confirmed_by: "00000000-0000-4000-8000-000000000004",
    };
    const { rpc, client } = clientWithRpc(companyConfirmedRow);

    const result = await confirmCompanyDeliveryArrival(
      client,
      trackingRow.service_day_id,
    );

    expect(rpc).toHaveBeenCalledWith("confirm_company_delivery_arrival", {
      target_service_day_id: trackingRow.service_day_id,
    });
    expect(result.companyArrivalConfirmedAt).toBe(
      companyConfirmedRow.company_arrival_confirmed_at,
    );
  });

  it("guarda el conteo recibido y conserva el detalle del faltante", async () => {
    const receiptRow: Database["public"]["Tables"]["service_receipt_checks"]["Row"] = {
      service_day_id: trackingRow.service_day_id,
      organization_id: trackingRow.organization_id,
      items: [{
        key: "side:ensalada",
        type: "side",
        label: "Ensaladas",
        expectedQuantity: 24,
        receivedQuantity: 23,
        note: "Faltó una ensalada",
      }],
      general_note: null,
      reported_by: "00000000-0000-4000-8000-000000000004",
      created_at: "2026-09-17T16:00:00.000Z",
      updated_at: "2026-09-17T16:00:00.000Z",
    };
    const { rpc, client } = clientWithRpc(receiptRow);

    const result = await saveServiceReceiptCheck(client, {
      serviceDayId: trackingRow.service_day_id,
      items: [{ key: "side:ensalada", receivedQuantity: 23, note: "Faltó una ensalada" }],
      generalNote: null,
    });

    expect(rpc).toHaveBeenCalledWith("save_service_receipt_check", {
      target_service_day_id: trackingRow.service_day_id,
      receipt_items: [{ key: "side:ensalada", receivedQuantity: 23, note: "Faltó una ensalada" }],
      receipt_note: null,
    });
    expect(result.items[0]).toMatchObject({
      label: "Ensaladas",
      expectedQuantity: 24,
      receivedQuantity: 23,
    });
  });
});
