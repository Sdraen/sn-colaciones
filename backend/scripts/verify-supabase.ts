import { createAdminSupabaseClient } from "../src/lib/supabase.js";

const supabase = createAdminSupabaseClient();
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
]);

const [organizations, profiles, diners] = checks.map((check) => check.result);

console.log("Supabase administrativo: conexión y migraciones hasta 0005 verificadas.");
console.log(
  `Datos actuales: ${organizations.count ?? 0} organizaciones, ${profiles.count ?? 0} perfiles, ${diners.count ?? 0} comensales.`,
);
console.log("Credenciales ocultas.");

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
