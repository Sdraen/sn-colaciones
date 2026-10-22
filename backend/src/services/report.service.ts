import type { SupabaseClient } from "@supabase/supabase-js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, OrderKind } from "../types/database.js";
import type { ReportPeriod } from "../schemas/report.schema.js";

type UserDatabaseClient = SupabaseClient<Database>;
type ReportOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "service_day_id"
  | "menu_option_id"
  | "diner_id"
  | "kind"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
  | "training_package"
  | "status"
  | "fulfilled_at"
>;

type ReportInput = {
  period: ReportPeriod;
  date?: string;
  company?: string;
};

type ReportDiner = Pick<
  Database["public"]["Tables"]["diners"]["Row"],
  "id" | "auth_user_id" | "full_name" | "type"
>;

export const INTERNAL_COMPANY_NAME = "Securitas";
const UNKNOWN_EXTERNAL_COMPANY_NAME = "Empresa externa";

type NominalReportOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "service_day_id"
  | "menu_option_id"
  | "diner_id"
  | "training_session_id"
  | "kind"
  | "beneficiary_label"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
  | "training_package"
  | "status"
  | "fulfilled_at"
>;

export type ReportTotals = {
  requested: number;
  confirmed: number;
  cancelled: number;
  fulfilled: number;
  byKind: Record<OrderKind, number>;
  sides: { salad: number; fruit: number; dessert: number; none: number };
  bread: number;
  tea: number;
  juice: number;
};

export async function getOrdersReport(
  supabase: UserDatabaseClient,
  input: ReportInput,
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
            "service_day_id, menu_option_id, diner_id, kind, quantity, side, bread, tea, training_package, status, fulfilled_at",
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

  const allOrders = (ordersResult.data ?? []) as ReportOrder[];
  const companyContext = await loadReportCompanyContext(supabase, allOrders);
  const selectedCompany = canonicalCompanyName(input.company, companyContext.companies);
  const orders = allOrders.filter((order) =>
    matchesReportCompany(
      resolveReportCompanyName(order, companyContext.companyByDinerId),
      selectedCompany,
    ),
  );
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
        .map((option) => {
          const optionOrders = dayOrders.filter(
            (order) => order.menu_option_id === option.id,
          );
          const optionTotals = summarizeReportOrders(optionOrders);
          return {
            menuOptionId: option.id,
            label: option.label,
            description: option.description,
            confirmed: countsByMenu.get(option.id) ?? 0,
            regular: optionTotals.byKind.regular,
            training: optionTotals.byKind.training,
            extra: optionTotals.byKind.extra + optionTotals.byKind.exceptional,
            special: optionTotals.byKind.special,
            salad: optionTotals.sides.salad,
            fruit: optionTotals.sides.fruit,
            juice: optionTotals.juice,
            bread: optionTotals.bread,
            tea: optionTotals.tea,
          };
        }),
    };
  });

  return {
    period: input.period,
    range,
    companies: companyContext.companies,
    selectedCompany,
    totals,
    days,
    generatedAt: new Date().toISOString(),
  };
}

export async function getCompleteOrdersReport(
  supabase: UserDatabaseClient,
  input: ReportInput,
) {
  const [summary, nominal] = await Promise.all([
    getOrdersReport(supabase, input),
    getNominalOrdersReport(supabase, input),
  ]);
  return { ...summary, nominalRows: nominal.rows };
}

export async function getNominalOrdersReport(
  supabase: UserDatabaseClient,
  input: ReportInput,
) {
  const range = resolveReportRange(input.period, input.date);
  const { data: serviceDays, error: serviceDaysError } = await supabase
    .from("service_days")
    .select("id, service_date")
    .gte("service_date", range.from)
    .lte("service_date", range.to)
    .order("service_date", { ascending: true });
  if (serviceDaysError) {
    throwSupabaseError(serviceDaysError, "No fue posible consultar los días del reporte nominal");
  }

  const dayIds = (serviceDays ?? []).map((day) => day.id);
  if (dayIds.length === 0) {
    return {
      period: input.period,
      range,
      companies: [] as string[],
      selectedCompany: input.company ?? null,
      totals: summarizeReportOrders([]),
      rows: [] as NominalReportRow[],
      generatedAt: new Date().toISOString(),
    };
  }

  const [ordersResult, optionsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, service_day_id, menu_option_id, diner_id, training_session_id, kind, beneficiary_label, quantity, side, bread, tea, training_package, status, fulfilled_at",
      )
      .in("service_day_id", dayIds),
    supabase
      .from("menu_options")
      .select("id, label, description")
      .in("service_day_id", dayIds),
  ]);
  if (ordersResult.error) {
    throwSupabaseError(ordersResult.error, "No fue posible consultar los pedidos del reporte nominal");
  }
  if (optionsResult.error) {
    throwSupabaseError(optionsResult.error, "No fue posible consultar los menús del reporte nominal");
  }

  const allOrders = (ordersResult.data ?? []) as NominalReportOrder[];
  const dinerIds = uniqueValues(allOrders.map((order) => order.diner_id));
  const trainingIds = uniqueValues(allOrders.map((order) => order.training_session_id));
  const [dinersResult, trainingResult] = await Promise.all([
    dinerIds.length
      ? supabase.from("diners").select("id, full_name, auth_user_id, type").in("id", dinerIds)
      : Promise.resolve({
          data: [] as ReportDiner[],
          error: null,
        }),
    trainingIds.length
      ? supabase.from("training_sessions").select("id, name").in("id", trainingIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ]);
  if (dinersResult.error) {
    throwSupabaseError(dinersResult.error, "No fue posible consultar los trabajadores del reporte");
  }
  if (trainingResult.error) {
    throwSupabaseError(trainingResult.error, "No fue posible consultar las capacitaciones del reporte");
  }

  const diners = (dinersResult.data ?? []) as ReportDiner[];
  const companyContext = await loadReportCompanyContext(supabase, allOrders, diners);
  const selectedCompany = canonicalCompanyName(input.company, companyContext.companies);
  const orders = allOrders.filter((order) =>
    matchesReportCompany(
      resolveReportCompanyName(order, companyContext.companyByDinerId),
      selectedCompany,
    ),
  );

  const datesByDay = new Map((serviceDays ?? []).map((day) => [day.id, day.service_date]));
  const optionsById = new Map((optionsResult.data ?? []).map((option) => [option.id, option]));
  const dinersById = new Map(diners.map((diner) => [diner.id, diner]));
  const trainingById = new Map(
    (trainingResult.data ?? []).map((training) => [training.id, training]),
  );

  const rows: NominalReportRow[] = orders
    .map((order) => {
      const diner = order.diner_id ? dinersById.get(order.diner_id) : undefined;
      const training = order.training_session_id
        ? trainingById.get(order.training_session_id)
        : undefined;
      const option = optionsById.get(order.menu_option_id);
      return {
        orderId: order.id,
        serviceDate: datesByDay.get(order.service_day_id) ?? range.from,
        beneficiaryName: resolveBeneficiaryName(order, diner?.full_name, training?.name),
        companyName: resolveReportCompanyName(order, companyContext.companyByDinerId),
        kind: order.kind,
        menuLabel: option?.label ?? "Alternativa no disponible",
        preparation: option?.description || option?.label || "Sin preparación informada",
        quantity: order.quantity,
        side: order.side,
        bread: order.bread,
        tea: order.tea,
        trainingPackage: order.training_package,
        status: order.status,
        fulfilled: Boolean(order.fulfilled_at),
      };
    })
    .sort((left, right) =>
      `${left.serviceDate}-${left.beneficiaryName}`.localeCompare(
        `${right.serviceDate}-${right.beneficiaryName}`,
        "es",
      ),
    );

  return {
    period: input.period,
    range,
    companies: companyContext.companies,
    selectedCompany,
    totals: summarizeReportOrders(orders),
    rows,
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
  const lastDay = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 0));
  return { from: toIsoDate(firstDay), to: toIsoDate(lastDay) };
}

export function summarizeReportOrders(orders: ReportOrder[]): ReportTotals {
  const totals: ReportTotals = {
    requested: 0,
    confirmed: 0,
    cancelled: 0,
    fulfilled: 0,
    byKind: { regular: 0, training: 0, extra: 0, exceptional: 0, special: 0 },
    sides: { salad: 0, fruit: 0, dessert: 0, none: 0 },
    bread: 0,
    tea: 0,
    juice: 0,
  };

  for (const order of orders) {
    totals.requested += order.quantity;
    if (order.status === "cancelled") {
      totals.cancelled += order.quantity;
      continue;
    }
    totals.confirmed += order.quantity;
    totals.byKind[order.kind === "exceptional" ? "extra" : order.kind] += order.quantity;
    if (order.fulfilled_at) totals.fulfilled += order.quantity;
    if (order.side === "ensalada") totals.sides.salad += order.quantity;
    if (order.side === "fruta") totals.sides.fruit += order.quantity;
    if (order.training_package) {
      totals.sides.fruit += order.quantity;
      totals.juice += order.quantity;
    }
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

function uniqueValues(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function loadReportCompanyContext(
  supabase: UserDatabaseClient,
  orders: Array<Pick<NominalReportOrder, "diner_id" | "kind">>,
  loadedDiners?: ReportDiner[],
) {
  const dinerIds = uniqueValues(orders.map((order) => order.diner_id));
  let diners = loadedDiners ?? [];

  if (!loadedDiners && dinerIds.length > 0) {
    const dinersResult = await supabase
      .from("diners")
      .select("id, full_name, auth_user_id, type")
      .in("id", dinerIds);
    if (dinersResult.error) {
      throwSupabaseError(
        dinersResult.error,
        "No fue posible consultar las empresas de los trabajadores del reporte",
      );
    }
    diners = (dinersResult.data ?? []) as ReportDiner[];
  }

  const externalUserIds = uniqueValues(
    diners
      .filter((diner) => diner.type === "external")
      .map((diner) => diner.auth_user_id),
  );
  const profilesResult = externalUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, external_company_name")
        .in("id", externalUserIds)
    : { data: [] as Array<{ id: string; external_company_name: string | null }>, error: null };
  if (profilesResult.error) {
    throwSupabaseError(
      profilesResult.error,
      "No fue posible consultar las empresas externas del reporte",
    );
  }

  const externalCompanyByUserId = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.external_company_name?.trim() || UNKNOWN_EXTERNAL_COMPANY_NAME,
    ]),
  );
  const companyByDinerId = new Map<string, string>();
  for (const diner of diners) {
    companyByDinerId.set(
      diner.id,
      diner.type === "external"
        ? externalCompanyByUserId.get(diner.auth_user_id ?? "") ?? UNKNOWN_EXTERNAL_COMPANY_NAME
        : INTERNAL_COMPANY_NAME,
    );
  }

  const companies = uniqueCompanyNames(
    orders.map((order) => resolveReportCompanyName(order, companyByDinerId)),
  );
  return { companies, companyByDinerId };
}

function resolveReportCompanyName(
  order: Pick<NominalReportOrder, "diner_id" | "kind">,
  companyByDinerId: Map<string, string>,
) {
  if (order.kind !== "regular" || !order.diner_id) return INTERNAL_COMPANY_NAME;
  return companyByDinerId.get(order.diner_id) ?? INTERNAL_COMPANY_NAME;
}

export function matchesReportCompany(companyName: string, selectedCompany?: string | null) {
  return !selectedCompany || normalizeCompanyName(companyName) === normalizeCompanyName(selectedCompany);
}

function canonicalCompanyName(selectedCompany: string | undefined, companies: string[]) {
  if (!selectedCompany) return null;
  return companies.find((company) => matchesReportCompany(company, selectedCompany)) ?? selectedCompany;
}

function uniqueCompanyNames(names: string[]) {
  const unique = new Map<string, string>();
  for (const name of names) {
    const trimmed = name.trim();
    const key = normalizeCompanyName(trimmed);
    if (key && !unique.has(key)) unique.set(key, trimmed);
  }
  return [...unique.values()].toSorted((left, right) => {
    if (left === INTERNAL_COMPANY_NAME) return -1;
    if (right === INTERNAL_COMPANY_NAME) return 1;
    return left.localeCompare(right, "es-CL");
  });
}

function normalizeCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}

function resolveBeneficiaryName(
  order: NominalReportOrder,
  dinerName?: string,
  trainingName?: string,
) {
  if (order.kind === "regular") return dinerName ?? "Trabajador no identificado";
  if (order.kind === "training") {
    return trainingName ? `Capacitación: ${trainingName}` : "Capacitación";
  }
  if (order.kind === "special") return order.beneficiary_label ?? "Colación especial";
  return order.beneficiary_label ?? (order.kind === "extra" ? "Colación extra" : "Solicitud excepcional");
}

export type NominalReportRow = {
  orderId: string;
  serviceDate: string;
  beneficiaryName: string;
  companyName: string;
  kind: OrderKind;
  menuLabel: string;
  preparation: string;
  quantity: number;
  side: Database["public"]["Tables"]["orders"]["Row"]["side"];
  bread: boolean;
  tea: boolean;
  trainingPackage: boolean;
  status: Database["public"]["Tables"]["orders"]["Row"]["status"];
  fulfilled: boolean;
};

export type NominalOrdersReport = Awaited<ReturnType<typeof getNominalOrdersReport>>;
