import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, OrderKind } from "../types/database.js";
import { getMenuWeek } from "./menu.service.js";

type UserDatabaseClient = SupabaseClient<Database>;

export async function listCalendarBlocks(
  supabase: UserDatabaseClient,
  input: { from?: string; to?: string },
) {
  let query = supabase
    .from("service_calendar_blocks")
    .select("id, starts_on, ends_on, kind, reason, created_at")
    .order("starts_on", { ascending: true });
  if (input.from) query = query.gte("ends_on", input.from);
  if (input.to) query = query.lte("starts_on", input.to);

  const { data, error } = await query;
  if (error) throwSupabaseError(error, "No fue posible consultar el calendario operacional");
  return (data ?? []).map(serializeCalendarBlock);
}

export async function createCalendarBlock(
  supabase: UserDatabaseClient,
  input: {
    organizationId: string;
    actorId: string;
    startsOn: string;
    endsOn: string;
    kind: "holiday" | "vacation" | "no_service" | "special";
    reason: string;
  },
) {
  const { data, error } = await supabase
    .from("service_calendar_blocks")
    .insert({
      organization_id: input.organizationId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      kind: input.kind,
      reason: input.reason,
      created_by: input.actorId,
    })
    .select("id, starts_on, ends_on, kind, reason, created_at")
    .single();
  if (error) throwSupabaseError(error, "No fue posible guardar el bloqueo de calendario");
  return serializeCalendarBlock(data);
}

export async function deleteCalendarBlock(
  supabase: UserDatabaseClient,
  blockId: string,
) {
  const { data, error } = await supabase
    .from("service_calendar_blocks")
    .delete()
    .eq("id", blockId)
    .select("id")
    .maybeSingle();
  if (error) throwSupabaseError(error, "No fue posible eliminar el bloqueo de calendario");
  if (!data) throw new AppError("No se encontró el bloqueo de calendario", 404, "CALENDAR_BLOCK_NOT_FOUND");
  return { id: data.id, deleted: true };
}

export async function setMenuOptionAvailability(
  supabase: UserDatabaseClient,
  input: { menuOptionId: string; capacity: number | null; visible?: boolean },
) {
  const { data, error } = await supabase.rpc("set_menu_option_availability", {
    target_menu_option_id: input.menuOptionId,
    informed_capacity: input.capacity,
    ...(input.visible === undefined ? {} : { is_visible: input.visible }),
  });
  if (error) throwSupabaseError(error, "No fue posible actualizar la disponibilidad");
  if (!data) {
    throw new AppError("No se encontró la alternativa de menú", 404, "MENU_OPTION_NOT_FOUND");
  }

  return {
    id: data.id,
    serviceDayId: data.service_day_id,
    capacity: data.capacity,
    capacityUpdatedAt: data.capacity_updated_at,
    visible: data.visible,
  };
}

export async function markOrderFulfillment(
  supabase: UserDatabaseClient,
  input: { orderId: string; delivered: boolean },
) {
  const { data, error } = await supabase.rpc("mark_order_fulfilled", {
    target_order_id: input.orderId,
    delivered: input.delivered,
  });
  if (error) throwSupabaseError(error, "No fue posible actualizar la entrega");
  if (!data) throw new AppError("No se encontró el pedido", 404, "ORDER_NOT_FOUND");

  return {
    id: data.id,
    status: data.status,
    fulfilledAt: data.fulfilled_at,
    updatedAt: data.updated_at,
  };
}

export async function resolveExceptionalRequest(
  supabase: UserDatabaseClient,
  input: {
    exceptionId: string;
    status: "approved" | "rejected";
    resolutionNote?: string;
  },
) {
  const { data, error } = await supabase.rpc("resolve_exception_request", {
    target_exception_id: input.exceptionId,
    decision: input.status,
    ...(input.resolutionNote === undefined
      ? {}
      : { rejection_note: input.resolutionNote }),
  });
  if (error) throwSupabaseError(error, "No fue posible resolver la solicitud extraordinaria");
  if (!data) throw new AppError("No se encontró la solicitud", 404, "EXCEPTION_NOT_FOUND");

  return {
    id: data.id,
    status: data.status,
    resolutionNote: data.resolution_note,
    resolvedAt: data.resolved_at,
  };
}

export async function getWeeklyProviderReport(
  supabase: UserDatabaseClient,
  startsOn?: string,
) {
  const menu = await getMenuWeek(supabase, { startsOn, includeDrafts: true });
  const serviceDayIds = menu.days.map((day) => day.id);
  const ordersResult = serviceDayIds.length
    ? await supabase
        .from("orders")
        .select(
          "id, service_day_id, menu_option_id, kind, quantity, side, bread, tea, status, fulfilled_at, created_at",
        )
        .in("service_day_id", serviceDayIds)
    : { data: [], error: null };
  if (ordersResult.error) {
    throwSupabaseError(ordersResult.error, "No fue posible generar el reporte semanal");
  }

  const orders = ordersResult.data ?? [];
  const totals = createEmptyTotals();
  const days = menu.days.map((day) => {
    const dayTotals = createEmptyTotals();
    const menuCounts = new Map<string, number>();

    for (const order of orders) {
      if (order.service_day_id !== day.id) continue;
      addOrderToTotals(dayTotals, order);
      addOrderToTotals(totals, order);
      if (order.status === "confirmed") {
        menuCounts.set(
          order.menu_option_id,
          (menuCounts.get(order.menu_option_id) ?? 0) + order.quantity,
        );
      }
    }

    return {
      serviceDayId: day.id,
      serviceDate: day.serviceDate,
      ...dayTotals,
      menuBreakdown: day.options.map((option) => ({
        menuOptionId: option.id,
        label: option.label,
        description: option.description,
        confirmed: menuCounts.get(option.id) ?? 0,
      })),
    };
  });

  return {
    menuWeek: {
      id: menu.id,
      startsOn: menu.startsOn,
      publishedAt: menu.publishedAt,
    },
    totals,
    days,
    generatedAt: new Date().toISOString(),
  };
}

export async function getProviderOperations(
  supabase: UserDatabaseClient,
  startsOn?: string,
) {
  const menu = await getMenuWeek(supabase, { startsOn, includeDrafts: true });
  const serviceDayIds = menu.days.map((day) => day.id);
  if (serviceDayIds.length === 0) {
    return { menu, orders: [] };
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, service_day_id, menu_option_id, diner_id, training_session_id, exception_request_id, kind, beneficiary_label, quantity, side, bread, tea, status, fulfilled_at, created_at, updated_at",
    )
    .in("service_day_id", serviceDayIds)
    .order("created_at", { ascending: false });
  if (ordersError) throwSupabaseError(ordersError, "No fue posible consultar el detalle operacional");

  const dinerIds = uniqueValues((orders ?? []).map((order) => order.diner_id));
  const trainingIds = uniqueValues(
    (orders ?? []).map((order) => order.training_session_id),
  );
  const exceptionIds = uniqueValues(
    (orders ?? []).map((order) => order.exception_request_id),
  );

  const [dinersResult, trainingsResult, exceptionsResult, requestsResult] = await Promise.all([
    dinerIds.length
      ? supabase
          .from("diners")
          .select("id, full_name, employee_code, type")
          .in("id", dinerIds)
      : Promise.resolve({ data: [], error: null }),
    trainingIds.length
      ? supabase
          .from("training_sessions")
          .select("id, name, expected_attendees")
          .in("id", trainingIds)
      : Promise.resolve({ data: [], error: null }),
    exceptionIds.length
      ? supabase
          .from("exception_requests")
          .select("id, reason, status, resolution_note")
          .in("id", exceptionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("exception_requests")
      .select(
        "id, service_day_id, menu_option_id, beneficiary_label, reason, side, bread, tea, status, resolution_note, requested_at, resolved_at",
      )
      .in("service_day_id", serviceDayIds)
      .order("requested_at", { ascending: false }),
  ]);
  if (dinersResult.error) throwSupabaseError(dinersResult.error, "No fue posible consultar trabajadores");
  if (trainingsResult.error) throwSupabaseError(trainingsResult.error, "No fue posible consultar capacitaciones");
  if (exceptionsResult.error) throwSupabaseError(exceptionsResult.error, "No fue posible consultar excepciones");
  if (requestsResult.error) throwSupabaseError(requestsResult.error, "No fue posible consultar solicitudes extraordinarias");

  const dinersById = new Map((dinersResult.data ?? []).map((diner) => [diner.id, diner]));
  const trainingsById = new Map(
    (trainingsResult.data ?? []).map((training) => [training.id, training]),
  );
  const exceptionsById = new Map(
    (exceptionsResult.data ?? []).map((exception) => [exception.id, exception]),
  );

  return {
    menu,
    exceptions: (requestsResult.data ?? []).map((request) => ({
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
    })),
    orders: (orders ?? []).map((order) => {
      const diner = order.diner_id ? dinersById.get(order.diner_id) : undefined;
      const training = order.training_session_id
        ? trainingsById.get(order.training_session_id)
        : undefined;
      const exception = order.exception_request_id
        ? exceptionsById.get(order.exception_request_id)
        : undefined;
      return {
        id: order.id,
        serviceDayId: order.service_day_id,
        menuOptionId: order.menu_option_id,
        kind: order.kind,
        beneficiary: diner
          ? {
              id: diner.id,
              fullName: diner.full_name,
              employeeCode: diner.employee_code,
              type: diner.type,
            }
          : {
              id: null,
              fullName: order.beneficiary_label ?? training?.name ?? "Sin identificar",
              employeeCode: null,
              type: training ? "training" : "external",
            },
        training: training
          ? {
              id: training.id,
              name: training.name,
              expectedAttendees: training.expected_attendees,
            }
          : null,
        exception: exception
          ? {
              id: exception.id,
              reason: exception.reason,
              status: exception.status,
              resolutionNote: exception.resolution_note,
            }
          : null,
        quantity: order.quantity,
        side: order.side,
        bread: order.bread,
        tea: order.tea,
        status: order.status,
        fulfilledAt: order.fulfilled_at,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      };
    }),
  };
}

function uniqueValues(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

type CalendarBlock = Pick<
  Database["public"]["Tables"]["service_calendar_blocks"]["Row"],
  "id" | "starts_on" | "ends_on" | "kind" | "reason" | "created_at"
>;

function serializeCalendarBlock(block: CalendarBlock) {
  return {
    id: block.id,
    startsOn: block.starts_on,
    endsOn: block.ends_on,
    kind: block.kind,
    reason: block.reason,
    createdAt: block.created_at,
  };
}

type ReportTotals = {
  requested: number;
  confirmed: number;
  cancelled: number;
  fulfilled: number;
  byKind: Record<OrderKind, number>;
  sides: { salad: number; dessert: number; none: number };
  bread: number;
  tea: number;
};

type ReportOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "kind" | "quantity" | "side" | "bread" | "tea" | "status" | "fulfilled_at"
>;

function createEmptyTotals(): ReportTotals {
  return {
    requested: 0,
    confirmed: 0,
    cancelled: 0,
    fulfilled: 0,
    byKind: { regular: 0, training: 0, extra: 0, exceptional: 0 },
    sides: { salad: 0, dessert: 0, none: 0 },
    bread: 0,
    tea: 0,
  };
}

function addOrderToTotals(totals: ReportTotals, order: ReportOrder) {
  totals.requested += order.quantity;
  if (order.status === "cancelled") {
    totals.cancelled += order.quantity;
    return;
  }

  totals.confirmed += order.quantity;
  totals.byKind[order.kind] += order.quantity;
  if (order.fulfilled_at) totals.fulfilled += order.quantity;
  if (order.side === "ensalada") totals.sides.salad += order.quantity;
  if (order.side === "postre") totals.sides.dessert += order.quantity;
  if (order.side === "ninguno") totals.sides.none += order.quantity;
  if (order.bread) totals.bread += order.quantity;
  if (order.tea) totals.tea += order.quantity;
}
