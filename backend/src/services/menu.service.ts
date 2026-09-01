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
  | "dessert"
  | "beverage"
  | "notes"
  | "capacity"
  | "capacity_updated_at"
  | "available_for_training"
  | "available_for_workers"
  | "visible"
  | "sort_order"
>;

export async function getMenuWeek(
  supabase: UserDatabaseClient,
  options: { startsOn?: string; includeDrafts: boolean; availableForWorkersOnly?: boolean },
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
      "id, service_day_id, category, label, description, dessert, beverage, notes, capacity, capacity_updated_at, available_for_training, available_for_workers, visible, sort_order",
    )
    .in("service_day_id", dayIds)
    .order("sort_order", { ascending: true });
  if (!options.includeDrafts) menuOptionsQuery = menuOptionsQuery.eq("visible", true);
  if (options.availableForWorkersOnly) {
    menuOptionsQuery = menuOptionsQuery.eq("available_for_workers", true);
  }
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
        dessert: menuOption.dessert,
        beverage: menuOption.beverage,
        notes: menuOption.notes,
        capacity: menuOption.capacity,
        capacityUpdatedAt: menuOption.capacity_updated_at,
        trainingMenu: menuOption.available_for_training,
        availableForWorkers: menuOption.available_for_workers,
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
      dessert: string | null;
      beverage: string | null;
      notes: string | null;
      capacity: number | null;
      trainingMenu: boolean;
      availableForWorkers: boolean;
      visible: boolean;
      sortOrder: number;
    }>;
  }>;
};

type MenuWeekRecord = Pick<
  Database["public"]["Tables"]["menu_weeks"]["Row"],
  "id" | "starts_on" | "published_at"
>;

export async function createMenuWeekDraft(
  supabase: UserDatabaseClient,
  input: MenuWeekDraftInput,
) {
  const existing = await findMenuWeekByStartsOn(supabase, input.startsOn);
  if (existing) {
    throw new AppError(
      "Ya existe una semana de menú para esa fecha",
      409,
      "MENU_WEEK_ALREADY_EXISTS",
    );
  }

  return saveMenuWeekDraft(supabase, input);
}

export async function updateMenuWeekDraft(
  supabase: UserDatabaseClient,
  input: MenuWeekDraftInput & { menuWeekId: string },
) {
  const existing = await findMenuWeekById(supabase, input.menuWeekId);
  assertEditableDraft(existing);
  if (existing.starts_on !== input.startsOn) {
    throw new AppError(
      "No puedes cambiar la fecha inicial de una semana existente",
      409,
      "MENU_WEEK_DATE_MISMATCH",
    );
  }

  return saveMenuWeekDraft(supabase, input);
}

export async function deleteMenuWeekDraft(
  supabase: UserDatabaseClient,
  menuWeekId: string,
) {
  const existing = await findMenuWeekById(supabase, menuWeekId);
  assertEditableDraft(existing);

  const { error } = await supabase.from("menu_weeks").delete().eq("id", menuWeekId);
  if (error) throwSupabaseError(error, "No fue posible eliminar el borrador semanal");
}

export async function copyPreviousMenuWeek(
  supabase: UserDatabaseClient,
  targetStartsOn: string,
) {
  const existing = await findMenuWeekByStartsOn(supabase, targetStartsOn);
  if (existing) {
    throw new AppError(
      "Ya existe una semana de menú para la fecha seleccionada",
      409,
      "MENU_WEEK_ALREADY_EXISTS",
    );
  }

  const previousStartsOn = addUtcDays(targetStartsOn, -7);
  let previousMenu;
  try {
    previousMenu = await getMenuWeek(supabase, {
      startsOn: previousStartsOn,
      includeDrafts: true,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "MENU_WEEK_NOT_FOUND") {
      throw new AppError(
        "No existe un menú en la semana anterior para copiar",
        404,
        "PREVIOUS_MENU_WEEK_NOT_FOUND",
      );
    }
    throw error;
  }

  const days: MenuWeekDraftInput["days"] = previousMenu.days.map((day, index) => ({
    serviceDate: addUtcDays(targetStartsOn, index),
    disabled: day.disabled,
    options: day.options.map((option) => ({
      category: option.category,
      label: option.label,
      description: option.description,
      dessert: option.dessert,
      beverage: option.beverage,
      notes: option.notes,
      capacity: option.capacity,
      trainingMenu: option.trainingMenu,
      availableForWorkers: option.availableForWorkers,
      visible: option.visible,
      sortOrder: option.sortOrder,
    })),
  }));

  return createMenuWeekDraft(supabase, { startsOn: targetStartsOn, days });
}

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
      dessert: option.dessert,
      beverage: option.beverage,
      notes: option.notes,
      capacity: option.capacity,
      training_menu: option.trainingMenu,
      available_for_workers: option.availableForWorkers,
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
  const existing = await findMenuWeekById(supabase, menuWeekId);
  assertEditableDraft(existing);
  const draft = await getMenuWeek(supabase, {
    startsOn: existing.starts_on,
    includeDrafts: true,
  });
  const incompleteDays = draft.days.filter((day) => {
    if (day.disabled) return false;
    const visibleOptions = day.options.filter(
      (option) => option.visible && option.availableForWorkers,
    );
    return (
      visibleOptions.length === 0 ||
      visibleOptions.some(
        (option) =>
          option.label.trim().length < 2 || option.description.trim().length < 3,
      )
    );
  });
  if (incompleteDays.length > 0) {
    throw new AppError(
      "Completa la preparación de todos los días antes de publicar",
      422,
      "MENU_WEEK_INCOMPLETE",
      { serviceDates: incompleteDays.map((day) => day.serviceDate) },
    );
  }

  const { data, error } = await supabase.rpc("publish_menu_week", {
    target_menu_week_id: menuWeekId,
  });
  if (error) throwSupabaseError(error, "No fue posible publicar el menú semanal");
  if (!data) throw new AppError("No se encontró la semana de menú", 404, "MENU_WEEK_NOT_FOUND");

  return getMenuWeek(supabase, { startsOn: data.starts_on, includeDrafts: true });
}

async function findMenuWeekById(
  supabase: UserDatabaseClient,
  menuWeekId: string,
) {
  const { data, error } = await supabase
    .from("menu_weeks")
    .select("id, starts_on, published_at")
    .eq("id", menuWeekId)
    .maybeSingle();
  if (error) throwSupabaseError(error, "No fue posible consultar la semana de menú");
  if (!data) {
    throw new AppError("No se encontró la semana de menú", 404, "MENU_WEEK_NOT_FOUND");
  }
  return data;
}

async function findMenuWeekByStartsOn(
  supabase: UserDatabaseClient,
  startsOn: string,
): Promise<MenuWeekRecord | null> {
  const { data, error } = await supabase
    .from("menu_weeks")
    .select("id, starts_on, published_at")
    .eq("starts_on", startsOn)
    .maybeSingle();
  if (error) throwSupabaseError(error, "No fue posible consultar la semana de menú");
  return data;
}

function assertEditableDraft(menuWeek: MenuWeekRecord) {
  if (menuWeek.published_at) {
    throw new AppError(
      "Un menú publicado no se puede modificar ni eliminar",
      409,
      "MENU_WEEK_PUBLISHED",
    );
  }
}

function addUtcDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
