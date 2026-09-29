import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, SideChoice } from "../types/database.js";
import { getMenuWeek } from "./menu.service.js";

type UserDatabaseClient = SupabaseClient<Database>;
type MealSelection = {
  serviceDayId: string;
  menuOptionId: string;
  quantity: number;
  side: SideChoice;
  bread: boolean;
  tea: boolean;
};

export async function createTrainingOrder(
  supabase: UserDatabaseClient,
  input: { serviceDayId: string; menuOptionId: string; name: string; attendeeCount: number; tea: boolean },
) {
  const { data, error } = await supabase.rpc("create_training_order", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    training_name: input.name,
    attendee_count: input.attendeeCount,
    selected_side: "ensalada",
    include_bread: true,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar la capacitación");
  if (!data) throw new AppError("No se generó el pedido de capacitación", 503, "TRAINING_SAVE_EMPTY");
  return serializeOperationalOrder(data);
}

export async function createTrainingBatch(
  supabase: UserDatabaseClient,
  input: { serviceDayId: string; name: string; tea: boolean; items: { menuOptionId: string; quantity: number }[] },
) {
  const { data, error } = await supabase.rpc("create_company_training_batch", {
    target_service_day_id: input.serviceDayId,
    training_name: input.name,
    include_tea: input.tea,
    requested_items: input.items,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar las preparaciones de capacitaciÃ³n");
  if (!Array.isArray(data)) throw new AppError("No se generÃ³ la capacitaciÃ³n", 503, "TRAINING_SAVE_EMPTY");
  return data.map((row) => serializeOperationalOrder(row as Database["public"]["Tables"]["orders"]["Row"]));
}

export async function createExtraOrder(
  supabase: UserDatabaseClient,
  input: MealSelection & { beneficiaryLabel: string; reason?: string },
) {
  const { data: serviceDay, error: dayError } = await supabase
    .from("service_days")
    .select("same_day_closes_at, delivery_closes_at")
    .eq("id", input.serviceDayId)
    .maybeSingle();
  if (dayError) throwSupabaseError(dayError, "No fue posible verificar el horario");
  if (!serviceDay) throw new AppError("No se encontró el día de servicio", 404, "SERVICE_DAY_NOT_FOUND");

  const now = Date.now();
  const directClose = new Date(serviceDay.same_day_closes_at).getTime();
  const finalClose = new Date(serviceDay.delivery_closes_at).getTime();
  if (now >= finalClose) {
    throw new AppError("A las 13:00 se cierran todas las colaciones del día", 409, "DAILY_ORDERS_CLOSED");
  }
  if (now >= directClose) {
    if (!input.reason?.trim()) {
      throw new AppError(
        "Entre las 11:00 y las 13:00 debes indicar el motivo para que la proveedora decida",
        422,
        "EXTRA_REASON_REQUIRED",
      );
    }
    const request = await createExceptionalRequest(supabase, {
      ...input,
      reason: input.reason,
    });
    return { outcome: "pending" as const, request };
  }

  const { data, error } = await supabase.rpc("create_extra_order_with_quantity", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    beneficiary_name: input.beneficiaryLabel,
    requested_quantity: input.quantity,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar la colación extra");
  if (!data) throw new AppError("No se generó la colación extra", 503, "EXTRA_SAVE_EMPTY");
  return { outcome: "confirmed" as const, order: serializeOperationalOrder(data) };
}

export async function createExtraBatch(
  supabase: UserDatabaseClient,
  input: {
    serviceDayId: string;
    beneficiaryLabel: string;
    side: SideChoice;
    bread: boolean;
    tea: boolean;
    reason?: string;
    items: { menuOptionId: string; quantity: number }[];
  },
) {
  const { data, error } = await supabase.rpc("create_company_extra_batch", {
    target_service_day_id: input.serviceDayId,
    beneficiary_name: input.beneficiaryLabel,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
    request_reason: input.reason ?? null,
    requested_items: input.items,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar las preparaciones extra");
  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new AppError("No se generaron las colaciones extra", 503, "EXTRA_SAVE_EMPTY");
  }
  return data;
}

export async function createSpecialMealRequest(
  supabase: UserDatabaseClient,
  input: {
    serviceDayId: string;
    beneficiaryLabel: string;
    quantity: number;
    preparation: string;
    reason: string;
  },
) {
  const { data, error } = await supabase.rpc("create_special_meal_request", {
    target_service_day_id: input.serviceDayId,
    beneficiary_name: input.beneficiaryLabel,
    requested_quantity: input.quantity,
    requested_preparation: input.preparation,
    request_reason: input.reason,
  });
  if (error) throwSupabaseError(error, "No fue posible enviar la solicitud especial");
  if (!data) throw new AppError("No se generó la solicitud especial", 503, "SPECIAL_REQUEST_SAVE_EMPTY");
  return serializeException(data);
}

export async function createExceptionalRequest(
  supabase: UserDatabaseClient,
  input: MealSelection & { beneficiaryLabel: string; reason: string },
) {
  const { data, error } = await supabase.rpc("request_exceptional_order_with_quantity", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    beneficiary_name: input.beneficiaryLabel,
    request_reason: input.reason,
    requested_quantity: input.quantity,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible enviar la solicitud tardía de colación extra");
  if (!data) throw new AppError("No se generó la solicitud", 503, "EXCEPTION_SAVE_EMPTY");
  return serializeException(data);
}

export async function updateCompanyOperationalOrder(
  supabase: UserDatabaseClient,
  input: Omit<MealSelection, "serviceDayId"> & {
    orderId: string;
    name: string;
    attendeeCount: number | null;
  },
) {
  const { data, error } = await supabase.rpc("update_company_operational_order_with_quantity", {
    target_order_id: input.orderId,
    target_menu_option_id: input.menuOptionId,
    record_name: input.name,
    attendee_count: input.attendeeCount,
    requested_quantity: input.quantity,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible modificar el registro");
  if (!data) throw new AppError("No se encontró el registro actualizado", 404, "OPERATION_NOT_FOUND");
  return serializeOperationalOrder(data);
}

export async function deleteCompanyOperationalOrder(
  supabase: UserDatabaseClient,
  orderId: string,
) {
  const { data, error } = await supabase.rpc("delete_company_operational_order", {
    target_order_id: orderId,
  });
  if (error) throwSupabaseError(error, "No fue posible eliminar el registro");
  if (!data) throw new AppError("No se encontró el registro eliminado", 404, "OPERATION_NOT_FOUND");
  return data;
}

export async function updateCompanyExtraRequest(
  supabase: UserDatabaseClient,
  input: Omit<MealSelection, "serviceDayId"> & {
    requestId: string;
    beneficiaryLabel: string;
    reason: string;
  },
) {
  const { data, error } = await supabase.rpc("update_company_extra_request_with_quantity", {
    target_request_id: input.requestId,
    target_menu_option_id: input.menuOptionId,
    beneficiary_name: input.beneficiaryLabel,
    request_reason: input.reason,
    requested_quantity: input.quantity,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible modificar la solicitud");
  if (!data) throw new AppError("No se encontró la solicitud actualizada", 404, "EXTRA_REQUEST_NOT_FOUND");
  return serializeException(data);
}

export async function deleteCompanyExtraRequest(
  supabase: UserDatabaseClient,
  requestId: string,
) {
  const { data, error } = await supabase.rpc("delete_company_extra_request", {
    target_request_id: requestId,
  });
  if (error) throwSupabaseError(error, "No fue posible eliminar la solicitud");
  if (!data) throw new AppError("No se encontró la solicitud eliminada", 404, "EXTRA_REQUEST_NOT_FOUND");
  return data;
}

export async function getCompanyOperations(
  supabase: UserDatabaseClient,
  startsOn?: string,
) {
  const menu = await getMenuWeek(supabase, {
    startsOn,
    includeDrafts: false,
    includeAvailability: true,
  });
  const serviceDayIds = menu.days.map((day) => day.id);
  const serviceDates = menu.days.map((day) => day.serviceDate);

  const [trainingResult, exceptionResult, orderResult, calendarResult] = await Promise.all([
    serviceDates.length
      ? supabase
          .from("training_sessions")
          .select("id, name, service_date, expected_attendees, created_at")
          .in("service_date", serviceDates)
          .order("service_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    serviceDayIds.length
      ? supabase
          .from("exception_requests")
          .select(
            "id, service_day_id, menu_option_id, beneficiary_label, reason, quantity, side, bread, tea, status, resolution_note, requested_at, resolved_at, request_kind, special_preparation",
          )
          .in("service_day_id", serviceDayIds)
          .order("requested_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    serviceDayIds.length
      ? supabase
          .from("orders")
          .select(
            "id, service_day_id, menu_option_id, training_session_id, exception_request_id, kind, beneficiary_label, quantity, side, bread, tea, training_package, status, fulfilled_at, created_at",
          )
          .in("service_day_id", serviceDayIds)
          .in("kind", ["training", "extra", "exceptional", "special"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    serviceDates.length
      ? supabase
          .from("service_calendar_blocks")
          .select("id, starts_on, ends_on, kind, reason")
          .lte("starts_on", serviceDates.at(-1)!)
          .gte("ends_on", serviceDates[0]!)
          .order("starts_on", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (trainingResult.error) throwSupabaseError(trainingResult.error, "No fue posible consultar capacitaciones");
  if (exceptionResult.error) throwSupabaseError(exceptionResult.error, "No fue posible consultar solicitudes de colaciones extra");
  if (orderResult.error) throwSupabaseError(orderResult.error, "No fue posible consultar pedidos operacionales");
  if (calendarResult.error) throwSupabaseError(calendarResult.error, "No fue posible consultar el calendario operacional");

  return {
    menuWeek: { id: menu.id, startsOn: menu.startsOn },
    trainingSessions: (trainingResult.data ?? []).map(serializeTrainingSession),
    extraRequests: (exceptionResult.data ?? []).map(serializeException),
    orders: (orderResult.data ?? []).map(serializeOperationalOrder),
    calendarBlocks: (calendarResult.data ?? []).map((block) => ({
      id: block.id,
      startsOn: block.starts_on,
      endsOn: block.ends_on,
      kind: block.kind,
      reason: block.reason,
    })),
  };
}

type OperationalOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "service_day_id"
  | "menu_option_id"
  | "training_session_id"
  | "exception_request_id"
  | "kind"
  | "beneficiary_label"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
  | "training_package"
  | "status"
  | "fulfilled_at"
  | "created_at"
>;

type ExceptionalRequest = Pick<
  Database["public"]["Tables"]["exception_requests"]["Row"],
  | "id"
  | "service_day_id"
  | "menu_option_id"
  | "beneficiary_label"
  | "reason"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
  | "status"
  | "resolution_note"
  | "requested_at"
  | "resolved_at"
  | "request_kind"
  | "special_preparation"
>;

type TrainingSession = Pick<
  Database["public"]["Tables"]["training_sessions"]["Row"],
  "id" | "name" | "service_date" | "expected_attendees" | "created_at"
>;

function serializeOperationalOrder(order: OperationalOrder) {
  return {
    id: order.id,
    serviceDayId: order.service_day_id,
    menuOptionId: order.menu_option_id,
    trainingSessionId: order.training_session_id,
    exceptionRequestId: order.exception_request_id,
    kind: order.kind,
    beneficiaryLabel: order.beneficiary_label,
    quantity: order.quantity,
    side: order.side,
    bread: order.bread,
    tea: order.tea,
    trainingPackage: order.training_package,
    status: order.status,
    fulfilledAt: order.fulfilled_at,
    createdAt: order.created_at,
  };
}

function serializeException(request: ExceptionalRequest) {
  return {
    id: request.id,
    serviceDayId: request.service_day_id,
    menuOptionId: request.menu_option_id,
    beneficiaryLabel: request.beneficiary_label,
    reason: request.reason,
    quantity: request.quantity,
    side: request.side,
    bread: request.bread,
    tea: request.tea,
    status: request.status,
    resolutionNote: request.resolution_note,
    requestedAt: request.requested_at,
    resolvedAt: request.resolved_at,
    requestKind: request.request_kind,
    specialPreparation: request.special_preparation,
  };
}

function serializeTrainingSession(training: TrainingSession) {
  return {
    id: training.id,
    name: training.name,
    serviceDate: training.service_date,
    expectedAttendees: training.expected_attendees,
    createdAt: training.created_at,
  };
}
