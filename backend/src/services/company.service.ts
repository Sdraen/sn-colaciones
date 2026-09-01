import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, SideChoice } from "../types/database.js";
import { getMenuWeek } from "./menu.service.js";

type UserDatabaseClient = SupabaseClient<Database>;
type MealSelection = {
  serviceDayId: string;
  menuOptionId: string;
  side: SideChoice;
  bread: boolean;
  tea: boolean;
};

export async function createTrainingOrder(
  supabase: UserDatabaseClient,
  input: MealSelection & { name: string; attendeeCount: number },
) {
  const { data, error } = await supabase.rpc("create_training_order", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    training_name: input.name,
    attendee_count: input.attendeeCount,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar la capacitación");
  if (!data) throw new AppError("No se generó el pedido de capacitación", 503, "TRAINING_SAVE_EMPTY");
  return serializeOperationalOrder(data);
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

  const { data, error } = await supabase.rpc("create_extra_order", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    beneficiary_name: input.beneficiaryLabel,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible registrar la colación extra");
  if (!data) throw new AppError("No se generó la colación extra", 503, "EXTRA_SAVE_EMPTY");
  return { outcome: "confirmed" as const, order: serializeOperationalOrder(data) };
}

export async function createExceptionalRequest(
  supabase: UserDatabaseClient,
  input: MealSelection & { beneficiaryLabel: string; reason: string },
) {
  const { data, error } = await supabase.rpc("request_exceptional_order", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    beneficiary_name: input.beneficiaryLabel,
    request_reason: input.reason,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible enviar la solicitud tardía de colación extra");
  if (!data) throw new AppError("No se generó la solicitud", 503, "EXCEPTION_SAVE_EMPTY");
  return serializeException(data);
}

export async function getCompanyOperations(
  supabase: UserDatabaseClient,
  startsOn?: string,
) {
  const menu = await getMenuWeek(supabase, { startsOn, includeDrafts: false });
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
            "id, service_day_id, menu_option_id, beneficiary_label, reason, side, bread, tea, status, resolution_note, requested_at, resolved_at",
          )
          .in("service_day_id", serviceDayIds)
          .order("requested_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    serviceDayIds.length
      ? supabase
          .from("orders")
          .select(
            "id, service_day_id, menu_option_id, training_session_id, kind, beneficiary_label, quantity, side, bread, tea, status, fulfilled_at, created_at",
          )
          .in("service_day_id", serviceDayIds)
          .in("kind", ["training", "extra", "exceptional"])
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
  | "kind"
  | "beneficiary_label"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
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
  | "side"
  | "bread"
  | "tea"
  | "status"
  | "resolution_note"
  | "requested_at"
  | "resolved_at"
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
    kind: order.kind,
    beneficiaryLabel: order.beneficiary_label,
    quantity: order.quantity,
    side: order.side,
    bread: order.bread,
    tea: order.tea,
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
    side: request.side,
    bread: request.bread,
    tea: request.tea,
    status: request.status,
    resolutionNote: request.resolution_note,
    requestedAt: request.requested_at,
    resolvedAt: request.resolved_at,
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
