import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
  new URL("../../supabase/migrations/", import.meta.url),
);

describe("contrato de migraciones de Supabase", () => {
  it("mantiene una secuencia única y continua de migraciones", () => {
    const migrationNumbers = readdirSync(migrationsDirectory)
      .filter((file) => /^\d{4}_.+\.sql$/.test(file))
      .map((file) => Number(file.slice(0, 4)))
      .sort((left, right) => left - right);

    expect(migrationNumbers).toEqual(
      Array.from({ length: migrationNumbers.length }, (_, index) => index + 1),
    );
    expect(new Set(migrationNumbers).size).toBe(migrationNumbers.length);
  });

  it("conserva la corrección RLS requerida por el guardado atómico del menú", () => {
    const migration = readMigration("0010_fix_atomic_menu_rls.sql");

    expect(migration).toMatch(
      /function private\.menu_week_belongs_to_current_org\([\s\S]*?volatile[\s\S]*?security definer/i,
    );
    expect(migration).toMatch(
      /function private\.service_day_belongs_to_current_org\([\s\S]*?volatile[\s\S]*?security definer/i,
    );
  });

  it("conserva el contrato de fruta, disponibilidad y protección contra sobrecupos", () => {
    const migration = readMigration(
      "0011_worker_menu_choices_and_availability.sql",
    );

    expect(migration).toMatch(
      /alter type public\.side_choice add value if not exists 'fruta'/i,
    );
    expect(migration).toContain(
      "function public.get_menu_option_availability(target_menu_week_id uuid)",
    );
    expect(migration).toContain("for no key update");
    expect(migration).toContain("MENU_OPTION_CAPACITY_EXCEEDED");
    expect(migration).toContain("DESSERT_ONLY_WEDNESDAY");
    expect(migration).toMatch(
      /new\.kind = 'regular'[\s\S]*?order_record\.diner_id = new\.diner_id/i,
    );
    expect(migration).toContain(
      "grant execute on function public.get_menu_option_availability(uuid) to authenticated",
    );
  });

  it("mantiene seguro el guardado atómico del menú sin depender de RLS intermedio", () => {
    const menuFunction = readMigration("0009_allow_late_current_week_menus.sql");
    const securityFix = readMigration("0012_secure_atomic_menu_save.sql");

    expect(menuFunction).toContain("actor_id uuid := auth.uid()");
    expect(menuFunction).toContain("private.current_user_has_role('provider_admin')");
    expect(menuFunction).toMatch(
      /from public\.profiles as profile[\s\S]*?where profile\.id = actor_id[\s\S]*?profile\.role = 'provider_admin'/i,
    );
    expect(securityFix).toContain(
      "alter function public.save_menu_week_draft(date, jsonb) security definer",
    );
    expect(securityFix).toContain(
      "alter function public.save_menu_week_draft(date, jsonb) set search_path = ''",
    );
    expect(securityFix).toContain(
      "revoke all on function public.save_menu_week_draft(date, jsonb) from public, anon",
    );
    expect(securityFix).toContain(
      "grant execute on function public.save_menu_week_draft(date, jsonb) to authenticated",
    );
  });

  it("permite completar el menú de capacitación sin desbloquear la semana publicada", () => {
    const migration = readMigration("0013_late_training_menu.sql");

    expect(migration).toContain(
      "function public.set_training_menu_for_week( target_menu_week_id uuid",
    );
    expect(migration).toMatch(/language plpgsql security definer set search_path = ''/i);
    expect(migration).toContain("private.current_user_has_role('provider_admin')");
    expect(migration).toMatch(
      /menu_week\.organization_id = target_organization_id[\s\S]*?for update/i,
    );
    expect(migration).toContain("available_for_training = true");
    expect(migration).toContain("available_for_workers = false");
    expect(migration).toContain("MENU_OPTION_CAPACITY_EXCEEDED");
    expect(migration).toContain(
      "revoke all on function public.set_training_menu_for_week(uuid, text, integer) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.set_training_menu_for_week(uuid, text, integer) to authenticated",
    );
  });

  it("protege las correcciones operacionales de Securitas", () => {
    const migration = readMigration("0014_company_operational_corrections.sql");

    for (const functionName of [
      "update_company_operational_order",
      "delete_company_operational_order",
      "update_company_extra_request",
      "delete_company_extra_request",
    ]) {
      expect(migration).toContain(`function public.${functionName}`);
    }
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("private.current_user_has_role('company_admin')");
    expect(migration).toContain("DELIVERY_ALREADY_COMPLETED");
    expect(migration).toContain("OPERATION_HISTORY_LOCKED");
    expect(migration).toContain("company.operation_corrected");
    expect(migration).toContain("company.operation_deleted");
    expect(migration).toContain("revoke delete on table public.orders from authenticated");
  });
});

function readMigration(fileName: string) {
  return readFileSync(`${migrationsDirectory}/${fileName}`, "utf8")
    .replace(/\s+/g, " ")
    .trim();
}
