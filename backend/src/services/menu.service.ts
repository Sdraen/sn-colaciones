import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, Json, MenuCategory } from "../types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;
type MenuOptionSummary = Pick<
  Database["public"]["Tables"]["menu_options"]["Row"],
  | "id"
  | "service_day_id"
  | "category"
  | "label"
  | "description"
  | "capacity"
  | "capacity_updated_at"
  | "available_for_training"
  | "visible"
  | "sort_order"
>;

export async function getMenuWeek(
  supabase: UserDatabaseClient,
  options: { startsOn?: string; includeDrafts: boolean },
) {
  let weekQuery = supabase
    .from("menu_weeks")
    .select("id, organization_id, starts_on, published_at")
    .order("starts_on", { ascending: false })
    .limit(1);

  if (options.startsOn) weekQuery = weekQuery.eq("starts_on", options.startsOn);
  if (!options.includeDrafts) weekQuery = weekQuery.not("published_at", "is", null);

  const { data: week, error: weekError } = await weekQuery.maybeSingle();
  if (weekError) throwSupabaseError(weekError, "No fue posible consultar el menú semanal");
  if (!week) {
    throw new AppError("No existe un menú semanal publicado", 404, "MENU_WEEK_NOT_FOUND");
  }

  const { data: days, error: daysError } = await supabase
    .from("service_days")
    .select(
      "id, service_date, phase, preorder_deadline, same_day_opens_at, same_day_closes_at, delivery_closes_at, availability_published_at, disabled",
    )
    .eq("menu_week_id", week.id)
    .order("service_date", { ascending: true });
  if (daysError) throwSupabaseError(daysError, "No fue posible consultar los días del menú");

  const dayIds = days.map((day) => day.id);
  let menuOptionsQuery = supabase
    .from("menu_options")
    .select(
      "id, service_day_id, category, label, description, capacity, capacity_updated_at, available_for_training, visible, sort_order",
    )
    .in("service_day_id", dayIds)
    .order("sort_order", { ascending: true });
  if (!options.includeDrafts) menuOptionsQuery = menuOptionsQuery.eq("visible", true);
  const optionsResult = dayIds.length
    ? await menuOptionsQuery
    : { data: [], error: null };
  if (optionsResult.error) {
    throwSupabaseError(optionsResult.error, "No fue posible consultar las alternativas del menú");
  }

  const optionRows: MenuOptionSummary[] = optionsResult.data ?? [];
  const optionsByDay = new Map<string, MenuOptionSummary[]>();
  for (const menuOption of optionRows) {
    const current = optionsByDay.get(menuOption.service_day_id) ?? [];
    current.push(menuOption);
    optionsByDay.set(menuOption.service_day_id, current);
  }

  return {
    id: week.id,
    organizationId: week.organization_id,
    startsOn: week.starts_on,
    publishedAt: week.published_at,
    days: days.map((day) => ({
      id: day.id,
      serviceDate: day.service_date,
      phase: day.phase,
      preorderDeadline: day.preorder_deadline,
      sameDayOpensAt: day.same_day_opens_at,
      sameDayClosesAt: day.same_day_closes_at,
      deliveryClosesAt: day.delivery_closes_at,
      availabilityPublishedAt: day.availability_published_at,
      disabled: day.disabled,
      options: (optionsByDay.get(day.id) ?? []).map((menuOption) => ({
        id: menuOption.id,
        category: menuOption.category,
        label: menuOption.label,
        description: menuOption.description,
        capacity: menuOption.capacity,
        capacityUpdatedAt: menuOption.capacity_updated_at,
        trainingMenu: menuOption.available_for_training,
        visible: menuOption.visible,
        sortOrder: menuOption.sort_order,
      })),
    })),
  };
}

type MenuWeekDraftInput = {
  startsOn: string;
  days: Array<{
    serviceDate: string;
    disabled: boolean;
    options: Array<{
      category: MenuCategory;
      label: string;
      description: string;
      capacity: number | null;
      trainingMenu: boolean;
      visible: boolean;
      sortOrder: number;
    }>;
  }>;
};

export async function saveMenuWeekDraft(
  supabase: UserDatabaseClient,
  input: MenuWeekDraftInput,
) {
  const weekDays: Json = input.days.map((day) => ({
    service_date: day.serviceDate,
    disabled: day.disabled,
    options: day.options.map((option) => ({
      category: option.category,
      label: option.label,
      description: option.description,
      capacity: option.capacity,
      training_menu: option.trainingMenu,
      visible: option.visible,
      sort_order: option.sortOrder,
    })),
  }));
  const { data, error } = await supabase.rpc("save_menu_week_draft", {
    target_starts_on: input.startsOn,
    week_days: weekDays,
  });
  if (error) throwSupabaseError(error, "No fue posible guardar el borrador semanal");
  if (!data) throw new AppError("No se generó el borrador semanal", 503, "MENU_SAVE_EMPTY");

  return getMenuWeek(supabase, { startsOn: data.starts_on, includeDrafts: true });
}

export async function publishMenuWeek(
  supabase: UserDatabaseClient,
  menuWeekId: string,
) {
  const { data, error } = await supabase.rpc("publish_menu_week", {
    target_menu_week_id: menuWeekId,
  });
  if (error) throwSupabaseError(error, "No fue posible publicar el menú semanal");
  if (!data) throw new AppError("No se encontró la semana de menú", 404, "MENU_WEEK_NOT_FOUND");

  return getMenuWeek(supabase, { startsOn: data.starts_on, includeDrafts: true });
}
