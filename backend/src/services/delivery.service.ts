import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { AuthenticatedProfile } from "../models/auth.js";
import type { Database } from "../types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;
type DeliveryTracking = Database["public"]["Tables"]["service_delivery_tracking"]["Row"];
type ServiceReceiptCheck = Database["public"]["Tables"]["service_receipt_checks"]["Row"];

export async function recordDeliveryEvent(
  supabase: UserDatabaseClient,
  input: {
    serviceDayId: string;
    event: "arrived" | "delivered";
    actor?: AuthenticatedProfile;
  },
) {
  const { data, error } = await supabase.rpc("record_delivery_event", {
    target_service_day_id: input.serviceDayId,
    event_name: input.event,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar el avance del despacho");
  if (!data) throw new AppError("No se registró el avance del despacho", 503, "DELIVERY_TRACKING_EMPTY");
  return serializeDeliveryTracking(data, input.actor ? [input.actor] : []);
}

export async function confirmServiceReceipt(
  supabase: UserDatabaseClient,
  serviceDayId: string,
  actor?: AuthenticatedProfile,
) {
  const { data, error } = await supabase.rpc("confirm_service_receipt", {
    target_service_day_id: serviceDayId,
  });
  if (error) throwSupabaseError(error, "No fue posible confirmar la recepción");
  if (!data) throw new AppError("No se confirmó la recepción", 503, "DELIVERY_TRACKING_EMPTY");
  return serializeDeliveryTracking(data, actor ? [actor] : []);
}

export async function confirmCompanyDeliveryArrival(
  supabase: UserDatabaseClient,
  serviceDayId: string,
  actor?: AuthenticatedProfile,
) {
  const { data, error } = await supabase.rpc("confirm_company_delivery_arrival", {
    target_service_day_id: serviceDayId,
  });
  if (error) throwSupabaseError(error, "No fue posible confirmar la llegada de la comida");
  if (!data) throw new AppError("No se confirmó la llegada de la comida", 503, "DELIVERY_TRACKING_EMPTY");
  return serializeDeliveryTracking(data, actor ? [actor] : []);
}

export async function saveServiceReceiptCheck(
  supabase: UserDatabaseClient,
  input: {
    serviceDayId: string;
    items: Array<{ key: string; receivedQuantity: number; note?: string | null }>;
    generalNote?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("save_service_receipt_check", {
    target_service_day_id: input.serviceDayId,
    receipt_items: input.items,
    receipt_note: input.generalNote ?? null,
  });
  if (error) throwSupabaseError(error, "No fue posible guardar el control de recepción");
  if (!data) throw new AppError("No se guardó el control de recepción", 503, "RECEIPT_CHECK_EMPTY");
  return serializeReceiptCheck(data);
}

export function serializeDeliveryTracking(
  tracking: DeliveryTracking,
  actors: AuthenticatedProfile[] = [],
) {
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
  return {
    serviceDayId: tracking.service_day_id,
    arrivedAt: tracking.arrived_at,
    arrivedBy: tracking.arrived_by,
    arrivedByProfile: serializeActor(tracking.arrived_by, actorsById),
    companyArrivalConfirmedAt: tracking.company_arrival_confirmed_at,
    companyArrivalConfirmedBy: tracking.company_arrival_confirmed_by,
    companyArrivalConfirmedByProfile: serializeActor(
      tracking.company_arrival_confirmed_by,
      actorsById,
    ),
    deliveredAt: tracking.delivered_at,
    deliveredBy: tracking.delivered_by,
    deliveredByProfile: serializeActor(tracking.delivered_by, actorsById),
    receiptConfirmedAt: tracking.receipt_confirmed_at,
    receiptConfirmedBy: tracking.receipt_confirmed_by,
    receiptConfirmedByProfile: serializeActor(
      tracking.receipt_confirmed_by,
      actorsById,
    ),
    updatedAt: tracking.updated_at,
  };
}

function serializeActor(
  actorId: string | null,
  actorsById: Map<string, AuthenticatedProfile>,
) {
  if (!actorId) return null;
  const actor = actorsById.get(actorId);
  if (!actor) return null;
  return {
    id: actor.id,
    fullName: actor.fullName,
    role: actor.role,
  };
}

export function serializeReceiptCheck(receipt: ServiceReceiptCheck) {
  return {
    serviceDayId: receipt.service_day_id,
    items: Array.isArray(receipt.items)
      ? receipt.items.flatMap((item) => {
          if (!isReceiptItem(item)) return [];
          return [{
            key: item.key,
            type: item.type,
            label: item.label,
            expectedQuantity: item.expectedQuantity,
            receivedQuantity: item.receivedQuantity,
            note: typeof item.note === "string" ? item.note : null,
          }];
        })
      : [],
    generalNote: receipt.general_note,
    reportedBy: receipt.reported_by,
    reportedAt: receipt.updated_at,
  };
}

function isReceiptItem(value: unknown): value is {
  key: string;
  type: "menu" | "side" | "complement";
  label: string;
  expectedQuantity: number;
  receivedQuantity: number;
  note?: string | null;
} {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.key === "string"
    && ["menu", "side", "complement"].includes(String(item.type))
    && typeof item.label === "string"
    && Number.isInteger(item.expectedQuantity)
    && Number.isInteger(item.receivedQuantity);
}
