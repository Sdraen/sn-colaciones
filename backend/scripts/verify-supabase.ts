import { createAdminSupabaseClient } from "../src/lib/supabase.js";

const supabase = createAdminSupabaseClient();
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const checks = await Promise.all([
  runCheck("organizations", () =>
    supabase.from("organizations").select("id", { count: "exact", head: true }),
  ),
  runCheck("profiles", () =>
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ),
  runCheck("diners", () =>
    supabase.from("diners").select("id", { count: "exact", head: true }),
  ),
  runCheck("migration 0004", () =>
    supabase
      .from("exception_requests")
      .select("id, side, bread, tea", { count: "exact", head: true }),
  ),
  runCheck("migration 0005", () =>
    supabase
      .from("menu_options")
      .select("id, available_for_training", { count: "exact", head: true }),
  ),
  runCheck("migration 0006 menu fields", () =>
    supabase
      .from("menu_options")
      .select("id, available_for_workers, dessert, beverage, notes", {
        count: "exact",
        head: true,
      }),
  ),
  runCheck("migration 0006 daily close", () =>
    supabase
      .from("service_days")
      .select("id, same_day_opens_at, same_day_closes_at, delivery_closes_at", {
        count: "exact",
        head: true,
      }),
  ),
  runCheck("migration 0008 delivery tracking", () =>
    supabase
      .from("service_delivery_tracking")
      .select(
        "service_day_id, arrived_at, delivered_at, receipt_confirmed_at",
        { count: "exact", head: true },
      ),
  ),
]);

// Estas llamadas comprueban que PostgREST reconoce las funciones y sus tipos.
// Usan un usuario administrativo sin perfil y UUID inexistentes, por lo que
// deben terminar antes de cualquier escritura.
await Promise.all([
  runExpectedRpcRejection(
    "migration 0011 availability RPC",
    () =>
      supabase.rpc("get_menu_option_availability", {
        target_menu_week_id: NIL_UUID,
      }),
    ["AUTH_REQUIRED", "permission denied for function"],
  ),
  runExpectedRpcRejection(
    "migration 0011 regular order RPC and fruit enum",
    () =>
      supabase.rpc("save_regular_order", {
        target_service_day_id: NIL_UUID,
        target_menu_option_id: NIL_UUID,
        selected_side: "fruta",
        include_bread: false,
        include_tea: false,
      }),
    [
      "AUTH_REQUIRED",
      "WORKER_ROLE_REQUIRED",
      "DINER_NOT_FOUND",
      "permission denied for function",
    ],
  ),
]);

const [organizations, profiles, diners] = checks.map((check) => check.result);

const { data: serviceDays, error: serviceDaysError } = await supabase
  .from("service_days")
  .select("service_date, delivery_closes_at")
  .order("service_date", { ascending: true });
if (serviceDaysError) throw serviceDaysError;
const invalidClose = (serviceDays ?? []).find(
  (day) => chileTime(day.delivery_closes_at) !== "13:00",
);
if (invalidClose) {
  throw new Error(
    `El día ${invalidClose.service_date} no cierra a las 13:00 de Santiago`,
  );
}

const { data: roleProfiles, error: roleError } = await supabase
  .from("profiles")
  .select("role")
  .eq("active", true);
if (roleError) throw roleError;
const roles = Object.groupBy(roleProfiles ?? [], (profile) => profile.role);

console.log("Supabase administrativo: conexión y migraciones hasta 0011 verificadas.");
console.log(
  `Datos actuales: ${organizations.count ?? 0} organizaciones, ${profiles.count ?? 0} perfiles, ${diners.count ?? 0} comensales.`,
);
console.log(
  `Roles activos: ${Object.entries(roles).map(([role, values]) => `${role}=${values?.length ?? 0}`).join(", ") || "ninguno"}.`,
);
console.log(`Horarios verificados: ${(serviceDays ?? []).length} días cierran a las 13:00 de Santiago.`);
console.log("Credenciales ocultas.");

function chileTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

async function runCheck(
  label: string,
  query: () => PromiseLike<{ count: number | null; error: { code?: string; message: string } | null }>,
) {
  const result = await query();
  if (result.error) {
    const detail = result.error.message || result.error.code || "error sin detalle";
    throw new Error(`Falló la verificación ${label}: ${detail}`);
  }
  return { label, result };
}

async function runExpectedRpcRejection(
  label: string,
  query: () => PromiseLike<{
    error: { code?: string; message: string } | null;
  }>,
  expectedMessages: string[],
) {
  const result = await query();

  if (!result.error) {
    throw new Error(
      `Falló la verificación ${label}: la llamada de prueba no fue rechazada`,
    );
  }

  const expectedRejection = expectedMessages.some((message) =>
    result.error?.message.toLowerCase().includes(message.toLowerCase()),
  );
  if (!expectedRejection) {
    const detail = result.error.message || result.error.code || "error sin detalle";
    throw new Error(`Falló la verificación ${label}: ${detail}`);
  }
}
