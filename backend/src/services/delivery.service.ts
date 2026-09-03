import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database } from "../types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;
type DeliveryTracking = Database["public"]["Tables"]["service_delivery_tracking"]["Row"];

export async function recordDeliveryEvent(
  supabase: UserDatabaseClient,
  input: { serviceDayId: string; event: "arrived" | "delivered" },
) {
  const { data, error } = await supabase.rpc("record_delivery_event", {
    target_service_day_id: input.serviceDayId,
    event_name: input.event,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar el avance del despacho");
  if (!data) throw new AppError("No se registró el avance del despacho", 503, "DELIVERY_TRACKING_EMPTY");
  return serializeDeliveryTracking(data);
}

export async function confirmServiceReceipt(
  supabase: UserDatabaseClient,
  serviceDayId: string,
) {
  const { data, error } = await supabase.rpc("confirm_service_receipt", {
    target_service_day_id: serviceDayId,
  });
  if (error) throwSupabaseError(error, "No fue posible confirmar la recepción");
  if (!data) throw new AppError("No se confirmó la recepción", 503, "DELIVERY_TRACKING_EMPTY");
  return serializeDeliveryTracking(data);
}

export function serializeDeliveryTracking(tracking: DeliveryTracking) {
  return {
    serviceDayId: tracking.service_day_id,
    arrivedAt: tracking.arrived_at,
    arrivedBy: tracking.arrived_by,
    deliveredAt: tracking.delivered_at,
    deliveredBy: tracking.delivered_by,
    receiptConfirmedAt: tracking.receipt_confirmed_at,
    receiptConfirmedBy: tracking.receipt_confirmed_by,
    updatedAt: tracking.updated_at,
  };
}
