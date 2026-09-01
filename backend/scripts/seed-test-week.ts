import { createAdminSupabaseClient } from "../src/lib/supabase.js";

const apply = process.argv.includes("--apply");
const supabase = createAdminSupabaseClient();
const today = chileDate(new Date());
const startsOn = mondayOf(today);

const { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("id, name")
  .eq("name", "Securitas Concepción")
  .maybeSingle();
if (organizationError) throw organizationError;
if (!organization) throw new Error("No existe la organización Securitas Concepción");

const { data: provider, error: providerError } = await supabase
  .from("profiles")
  .select("id")
  .eq("organization_id", organization.id)
  .eq("role", "provider_admin")
  .eq("active", true)
  .limit(1)
  .maybeSingle();
if (providerError) throw providerError;
if (!provider) throw new Error("No existe una administradora proveedora activa");

const { data: existingWeek, error: weekLookupError } = await supabase
  .from("menu_weeks")
  .select("id, published_at")
  .eq("organization_id", organization.id)
  .eq("starts_on", startsOn)
  .maybeSingle();
if (weekLookupError) throw weekLookupError;

if (existingWeek) {
  const { count, error } = await supabase
    .from("service_days")
    .select("id", { count: "exact", head: true })
    .eq("menu_week_id", existingWeek.id);
  if (error) throw error;
  if ((count ?? 0) > 0) {
    console.log(`La semana ${startsOn} ya tiene ${count} días. No se modificó nada.`);
    process.exit(0);
  }
}

console.log(`Organización: ${organization.name}`);
console.log(`Semana de prueba: ${startsOn}`);
console.log("Contenido: cinco días hábiles, alternativas caseras y menú separado de capacitación.");
if (!apply) {
  console.log("Vista previa terminada. Agrega --apply para crear la semana.");
  process.exit(0);
}

let menuWeekId = existingWeek?.id;
let createdWeek = false;
const createdDayIds: string[] = [];

try {
  if (!menuWeekId) {
    const { data, error } = await supabase
      .from("menu_weeks")
      .insert({
        organization_id: organization.id,
        starts_on: startsOn,
        published_at: new Date().toISOString(),
        created_by: provider.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    menuWeekId = data.id;
    createdWeek = true;
  } else if (!existingWeek?.published_at) {
    const { error } = await supabase
      .from("menu_weeks")
      .update({ published_at: new Date().toISOString() })
      .eq("id", menuWeekId);
    if (error) throw error;
  }

  const days = buildWeek(startsOn);
  for (const day of days) {
    const { data: savedDay, error: dayError } = await supabase
      .from("service_days")
      .insert({
        menu_week_id: menuWeekId,
        service_date: day.serviceDate,
        phase: day.disabled ? "closed" : phaseFor(day.serviceDate),
        preorder_deadline: zonedIso(addDays(day.serviceDate, -1), 22),
        same_day_opens_at: zonedIso(day.serviceDate, 8),
        same_day_closes_at: zonedIso(day.serviceDate, 11),
        delivery_closes_at: zonedIso(day.serviceDate, 13),
        availability_published_at: day.disabled ? null : new Date().toISOString(),
        disabled: day.disabled,
      })
      .select("id")
      .single();
    if (dayError) throw dayError;
    createdDayIds.push(savedDay.id);

    if (day.options.length > 0) {
      const { error: optionsError } = await supabase.from("menu_options").insert(
        day.options.map((option, index) => ({
          service_day_id: savedDay.id,
          category: option.category,
          label: option.label,
          description: option.description,
          dessert: option.dessert,
          beverage: option.beverage,
          notes: option.notes,
          capacity: option.capacity,
          capacity_updated_at: new Date().toISOString(),
          available_for_training: option.training,
          available_for_workers: !option.training,
          visible: true,
          sort_order: option.training ? 99 : index,
        })),
      );
      if (optionsError) throw optionsError;
    }
  }

  console.log(`Semana publicada: ${startsOn}, con ${createdDayIds.length} días de servicio.`);
  console.log("Los trabajadores ya pueden reservar los días futuros de esta semana.");
} catch (error) {
  if (createdWeek && menuWeekId) {
    await supabase.from("menu_weeks").delete().eq("id", menuWeekId);
  } else if (createdDayIds.length > 0) {
    await supabase.from("service_days").delete().in("id", createdDayIds);
  }
  throw error;
}

type SeedOption = {
  category: "principal" | "vegetariano" | "hipocalorico" | "sandwich" | "handroll" | "especial";
  label: string;
  description: string;
  dessert: string | null;
  beverage: string | null;
  notes: string | null;
  capacity: number | null;
  training: boolean;
};

function dailyMenuTemplates(): Array<Omit<SeedOption, "training">[]> {
  return [
  [
    meal("Menú casero", "Espirales con salsa boloñesa", "principal", 45),
    meal("Vegetariano", "Espirales con salsa de verduras", "vegetariano", 15),
    meal("Hipocalórico", "Pechuga de pollo con verduras salteadas", "hipocalorico", 15),
  ],
  [
    meal("Menú casero", "Pollo al jugo con arroz", "principal", 50),
    meal("Vegetariano", "Tortilla de verduras con arroz", "vegetariano", 15),
    meal("Hipocalórico", "Pollo grillado con ensalada surtida", "hipocalorico", 15),
  ],
  [
    meal("Menú casero", "Porotos con riendas", "principal", 50),
    meal("Vegetariano", "Guiso de lentejas con verduras", "vegetariano", 15),
    meal("Hipocalórico", "Pavo al horno con ensalada", "hipocalorico", 15),
  ],
  [
    meal("Menú casero", "Carne mechada con puré", "principal", 45),
    meal("Vegetariano", "Croquetas de legumbres con puré", "vegetariano", 15),
    meal("Hipocalórico", "Carne magra con verduras", "hipocalorico", 15),
  ],
  [
    meal("Handroll", "Handroll de pollo con queso crema", "handroll", 40),
    meal("Vegetariano", "Handroll de verduras con queso crema", "vegetariano", 20),
    meal("Hipocalórico", "Ensalada de pollo y vegetales", "hipocalorico", 15),
  ],
  ];
}

function buildWeek(weekStart: string) {
  const dailyMenus = dailyMenuTemplates();
  return Array.from({ length: 7 }, (_, index) => {
    const disabled = index >= 5;
    const regular = disabled ? [] : dailyMenus[index]!;
    const training: SeedOption[] = disabled
      ? []
      : [{
          label: "Menú capacitación",
          description: "Pollo al jugo con arroz y ensalada",
          category: "especial",
          dessert: "Fruta de estación",
          beverage: "Jugo en caja",
          notes: "Preparar el grupo completo en un solo despacho",
          capacity: 120,
          training: true,
        }];
    return {
      serviceDate: addDays(weekStart, index),
      disabled,
      options: [...regular.map((option) => ({ ...option, training: false })), ...training],
    };
  });
}

function meal(
  label: string,
  description: string,
  category: SeedOption["category"],
  capacity: number,
): Omit<SeedOption, "training"> {
  return {
    label,
    description,
    category,
    dessert: "Fruta de estación",
    beverage: "Jugo en caja",
    notes: null,
    capacity,
  };
}

function phaseFor(serviceDate: string) {
  const now = Date.now();
  if (now <= new Date(zonedIso(addDays(serviceDate, -1), 22)).getTime()) return "preorder_open" as const;
  if (now < new Date(zonedIso(serviceDate, 8)).getTime()) return "preorder_closed" as const;
  if (now < new Date(zonedIso(serviceDate, 11)).getTime()) return "same_day_open" as const;
  return "closed" as const;
}

function zonedIso(date: string, hour: number) {
  const [year, month, day] = date.split("-").map(Number);
  const desired = Date.UTC(year!, month! - 1, day!, hour, 0, 0);
  const firstPass = new Date(desired);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(firstPass);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return new Date(desired - (representedAsUtc - desired)).toISOString();
}

function chileDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function mondayOf(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
