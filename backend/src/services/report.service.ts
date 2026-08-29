import type { SupabaseClient } from "@supabase/supabase-js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, OrderKind } from "../types/database.js";
import type { ReportPeriod } from "../schemas/report.schema.js";

type UserDatabaseClient = SupabaseClient<Database>;
type ReportOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "service_day_id"
  | "menu_option_id"
  | "kind"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
  | "status"
  | "fulfilled_at"
>;

export type ReportTotals = {
  requested: number;
  confirmed: number;
  cancelled: number;
  fulfilled: number;
  byKind: Record<OrderKind, number>;
  sides: { salad: number; dessert: number; none: number };
  bread: number;
  tea: number;
};

export async function getOrdersReport(
  supabase: UserDatabaseClient,
  input: { period: ReportPeriod; date?: string },
) {
  const range = resolveReportRange(input.period, input.date);
  const { data: serviceDays, error: serviceDaysError } = await supabase
    .from("service_days")
    .select("id, service_date")
    .gte("service_date", range.from)
    .lte("service_date", range.to)
    .order("service_date", { ascending: true });
  if (serviceDaysError) {
    throwSupabaseError(serviceDaysError, "No fue posible consultar los días del reporte");
  }

  const dayIds = (serviceDays ?? []).map((day) => day.id);
  const [ordersResult, optionsResult] = dayIds.length
    ? await Promise.all([
        supabase
          .from("orders")
          .select(
            "service_day_id, menu_option_id, kind, quantity, side, bread, tea, status, fulfilled_at",
          )
          .in("service_day_id", dayIds),
        supabase
          .from("menu_options")
          .select("id, service_day_id, label, description")
          .in("service_day_id", dayIds),
      ])
    : [
        { data: [] as ReportOrder[], error: null },
        {
          data: [] as Array<{
            id: string;
            service_day_id: string;
            label: string;
            description: string;
          }>,
          error: null,
        },
      ];

  if (ordersResult.error) {
    throwSupabaseError(ordersResult.error, "No fue posible consultar los pedidos del reporte");
  }
  if (optionsResult.error) {
    throwSupabaseError(optionsResult.error, "No fue posible consultar los menús del reporte");
  }

  const orders = ordersResult.data ?? [];
  const menuOptions = optionsResult.data ?? [];
  const totals = summarizeReportOrders(orders);
  const days = (serviceDays ?? []).map((day) => {
    const dayOrders = orders.filter((order) => order.service_day_id === day.id);
    const countsByMenu = new Map<string, number>();
    for (const order of dayOrders) {
      if (order.status !== "confirmed") continue;
      countsByMenu.set(
        order.menu_option_id,
        (countsByMenu.get(order.menu_option_id) ?? 0) + order.quantity,
      );
    }

    return {
      serviceDayId: day.id,
      serviceDate: day.service_date,
      totals: summarizeReportOrders(dayOrders),
      menuBreakdown: menuOptions
        .filter((option) => option.service_day_id === day.id)
        .map((option) => ({
          menuOptionId: option.id,
          label: option.label,
          description: option.description,
          confirmed: countsByMenu.get(option.id) ?? 0,
        })),
    };
  });

  return {
    period: input.period,
    range,
    totals,
    days,
    generatedAt: new Date().toISOString(),
  };
}

export function resolveReportRange(
  period: ReportPeriod,
  selectedDate = chileToday(),
) {
  const selected = parseIsoDate(selectedDate);
  if (period === "daily") return { from: selectedDate, to: selectedDate };

  if (period === "weekly") {
    const weekday = selected.getUTCDay() || 7;
    const monday = new Date(selected);
    monday.setUTCDate(selected.getUTCDate() - weekday + 1);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { from: toIsoDate(monday), to: toIsoDate(sunday) };
  }

  const firstDay = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
  return { from: toIsoDate(firstDay), to: selectedDate };
}

export function summarizeReportOrders(orders: ReportOrder[]): ReportTotals {
  const totals: ReportTotals = {
    requested: 0,
    confirmed: 0,
    cancelled: 0,
    fulfilled: 0,
    byKind: { regular: 0, training: 0, extra: 0, exceptional: 0 },
    sides: { salad: 0, dessert: 0, none: 0 },
    bread: 0,
    tea: 0,
  };

  for (const order of orders) {
    totals.requested += order.quantity;
    if (order.status === "cancelled") {
      totals.cancelled += order.quantity;
      continue;
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

  return totals;
}

function chileToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== value) {
    throw new Error("La fecha del reporte no es válida");
  }
  return parsed;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
