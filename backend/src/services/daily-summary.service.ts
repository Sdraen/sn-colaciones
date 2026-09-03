import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, OrderKind, SideChoice } from "../types/database.js";
import { serializeDeliveryTracking } from "./delivery.service.js";

type UserDatabaseClient = SupabaseClient<Database>;

export async function getDailySummary(
  supabase: UserDatabaseClient,
  serviceDate = chileIsoDate(new Date()),
) {
  const { data: day, error: dayError } = await supabase
    .from("service_days")
    .select("id, service_date, delivery_closes_at, disabled")
    .eq("service_date", serviceDate)
    .maybeSingle();
  if (dayError) throwSupabaseError(dayError, "No fue posible consultar el día de servicio");
  if (!day) throw new AppError("No existe un día de servicio para la fecha indicada", 404, "SERVICE_DAY_NOT_FOUND");

  const [optionsResult, ordersResult, pendingResult, trackingResult] = await Promise.all([
    supabase
      .from("menu_options")
      .select("id, label, description, dessert, beverage, notes")
      .eq("service_day_id", day.id),
    supabase
      .from("orders")
      .select("id, menu_option_id, diner_id, training_session_id, kind, beneficiary_label, quantity, side, bread, tea, status, fulfilled_at, created_at")
      .eq("service_day_id", day.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("exception_requests")
      .select("id")
      .eq("service_day_id", day.id)
      .eq("status", "pending"),
    supabase
      .from("service_delivery_tracking")
      .select("service_day_id, organization_id, arrived_at, arrived_by, delivered_at, delivered_by, receipt_confirmed_at, receipt_confirmed_by, updated_at")
      .eq("service_day_id", day.id)
      .maybeSingle(),
  ]);
  if (optionsResult.error) throwSupabaseError(optionsResult.error, "No fue posible consultar el menú del día");
  if (ordersResult.error) throwSupabaseError(ordersResult.error, "No fue posible consultar las colaciones del día");
  if (pendingResult.error) throwSupabaseError(pendingResult.error, "No fue posible consultar las solicitudes pendientes");
  if (trackingResult.error) throwSupabaseError(trackingResult.error, "No fue posible consultar el seguimiento del despacho");

  const orders = ordersResult.data ?? [];
  const dinerIds = unique(orders.map((order) => order.diner_id));
  const trainingIds = unique(orders.map((order) => order.training_session_id));
  const [dinersResult, trainingsResult] = await Promise.all([
    dinerIds.length
      ? supabase.from("diners").select("id, full_name, employee_code").in("id", dinerIds)
      : Promise.resolve({ data: [], error: null }),
    trainingIds.length
      ? supabase.from("training_sessions").select("id, name, expected_attendees").in("id", trainingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (dinersResult.error) throwSupabaseError(dinersResult.error, "No fue posible consultar los trabajadores");
  if (trainingsResult.error) throwSupabaseError(trainingsResult.error, "No fue posible consultar las capacitaciones");

  const optionsById = new Map((optionsResult.data ?? []).map((option) => [option.id, option]));
  const dinersById = new Map((dinersResult.data ?? []).map((diner) => [diner.id, diner]));
  const trainingsById = new Map((trainingsResult.data ?? []).map((training) => [training.id, training]));
  const confirmed = orders.filter((order) => order.status === "confirmed");
  const menuTotals = new Map<string, { menuOptionId: string; label: string; description: string; quantity: number }>();
  const componentTotals = new Map<string, { label: string; quantity: number }>();
  const byKind = { regular: 0, training: 0, extra: 0 };
  const sides = { ensalada: 0, postre: 0, ninguno: 0 } satisfies Record<SideChoice, number>;
  let bread = 0;
  let tea = 0;

  const manifest = confirmed.map((order) => {
    const quantity = order.quantity;
    const option = optionsById.get(order.menu_option_id);
    const legacyKind = order.kind as OrderKind;
    const publicKind = legacyKind === "exceptional" ? "extra" : legacyKind;
    byKind[publicKind] += quantity;
    sides[order.side] += quantity;
    if (order.bread) bread += quantity;
    if (order.tea) tea += quantity;
    const menu = menuTotals.get(order.menu_option_id) ?? {
      menuOptionId: order.menu_option_id,
      label: option?.label ?? "Menú sin identificar",
      description: option?.description ?? "",
      quantity: 0,
    };
    menu.quantity += quantity;
    menuTotals.set(order.menu_option_id, menu);
    addComponent(componentTotals, option?.dessert, quantity);
    addComponent(componentTotals, option?.beverage, quantity);

    const diner = order.diner_id ? dinersById.get(order.diner_id) : undefined;
    const training = order.training_session_id
      ? trainingsById.get(order.training_session_id)
      : undefined;
    return {
      orderId: order.id,
      beneficiary: diner?.full_name ?? order.beneficiary_label ?? training?.name ?? "Sin identificar",
      employeeCode: diner?.employee_code ?? null,
      kind: publicKind,
      quantity,
      menuLabel: option?.label ?? "Menú sin identificar",
      menuDescription: option?.description ?? "",
      dessert: option?.dessert ?? null,
      beverage: option?.beverage ?? null,
      side: order.side,
      bread: order.bread,
      tea: order.tea,
      fulfilledAt: order.fulfilled_at,
    };
  });

  const total = confirmed.reduce((sum, order) => sum + order.quantity, 0);
  return {
    serviceDate: day.service_date,
    state: Date.now() >= new Date(day.delivery_closes_at).getTime() ? "final" : "in_progress",
    closesAt: day.delivery_closes_at,
    generatedAt: new Date().toISOString(),
    disabled: day.disabled,
    pendingExtraRequests: pendingResult.data?.length ?? 0,
    delivery: trackingResult.data
      ? serializeDeliveryTracking(trackingResult.data)
      : {
          serviceDayId: day.id,
          arrivedAt: null,
          arrivedBy: null,
          deliveredAt: null,
          deliveredBy: null,
          receiptConfirmedAt: null,
          receiptConfirmedBy: null,
          updatedAt: null,
        },
    totals: {
      colations: total,
      delivered: confirmed.filter((order) => order.fulfilled_at !== null).reduce((sum, order) => sum + order.quantity, 0),
      byKind,
      sides,
      bread,
      tea,
    },
    menuBreakdown: [...menuTotals.values()].sort((a, b) => b.quantity - a.quantity),
    components: [...componentTotals.values()].sort((a, b) => b.quantity - a.quantity),
    trainingGroups: confirmed
      .filter((order) => order.training_session_id)
      .map((order) => {
        const training = trainingsById.get(order.training_session_id!);
        return { id: training?.id ?? order.id, name: training?.name ?? "Capacitación", quantity: order.quantity };
      }),
    manifest,
  };
}

function addComponent(target: Map<string, { label: string; quantity: number }>, label: string | null | undefined, quantity: number) {
  if (!label) return;
  const current = target.get(label) ?? { label, quantity: 0 };
  current.quantity += quantity;
  target.set(label, current);
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

function chileIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
