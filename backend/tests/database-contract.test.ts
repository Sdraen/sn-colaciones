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

  it("protege la edición de menús publicados y sus reservas", () => {
    const migration = readMigration("0015_controlled_published_menu_edits.sql");

    expect(migration).toContain("function public.update_published_menu_week");
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toMatch(/profile\.role = 'provider_admin'/i);
    expect(migration).toMatch(/select menu_week\.\* into target_week/i);
    expect(migration).not.toMatch(/into target_week,\s*target_timezone/i);
    expect(migration).toContain("MENU_EDIT_CONFIRMATION_REQUIRED");
    expect(migration).toContain("MENU_OPTION_HAS_RESERVATIONS");
    expect(migration).toContain("MENU_DAY_HAS_RESERVATIONS");
    expect(migration).toContain("OPERATION_HISTORY_LOCKED");
    expect(migration).toContain("DELIVERY_ALREADY_COMPLETED");
    expect(migration).toContain("published_menu_changed");
    expect(migration).toContain("menu_week.published_corrected");
    expect(migration).toContain(
      "grant execute on function public.update_published_menu_week(uuid, jsonb, boolean) to authenticated",
    );
  });

  it("protege los ajustes operativos de cupo", () => {
    const migration = readMigration(
      "0016_safe_operational_capacity_adjustments.sql",
    );

    expect(migration).toContain(
      "function public.set_menu_option_availability",
    );
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("MENU_CAPACITY_BELOW_RESERVATIONS");
    expect(migration).toContain("MENU_OPTION_HAS_RESERVATIONS");
    expect(migration).toContain("OPERATION_HISTORY_LOCKED");
    expect(migration).toContain("DELIVERY_ALREADY_COMPLETED");
    expect(migration).toContain("order_record.status = 'confirmed'");
    expect(migration).toContain(
      "grant execute on function public.set_menu_option_availability(uuid, integer, boolean) to authenticated",
    );
  });

  it("exige cupo diario y mantiene atómicas las capacitaciones", () => {
    const migration = readMigration("0017_training_capacity_guard.sql");

    expect(migration).toContain("function private.enforce_menu_option_capacity");
    expect(migration).toContain("new.kind = 'training'");
    expect(migration).toContain("TRAINING_CAPACITY_REQUIRED");
    expect(migration).toContain("TRAINING_CAPACITY_EXCEEDED");
    expect(migration).toContain("for no key update");
    expect(migration).toContain("MENU_OPTION_CAPACITY_EXCEEDED");
    expect(migration).toMatch(
      /order_record\.id <> new\.id[\s\S]*?already_confirmed \+ new\.quantity > option_capacity/i,
    );
  });

  it("permite pan y té juntos y limita los nuevos acompañamientos", () => {
    const migration = readMigration("0018_worker_meal_selection_rules.sql");

    expect(migration).toContain("check (bread or tea)");
    expect(migration).toContain("selected_side::text not in ('ensalada', 'fruta')");
    expect(migration).toContain("INVALID_SIDE_CHOICE");
    expect(migration).toContain("not (include_bread or include_tea)");
    expect(migration).not.toContain("DESSERT_ONLY_WEDNESDAY");
  });

  it("registra la revisión de recepción y avisa los faltantes", () => {
    const migration = readMigration("0019_company_receipt_control.sql");

    expect(migration).toContain("create table public.service_receipt_checks");
    expect(migration).toContain("function public.save_service_receipt_check");
    expect(migration).toContain("profile.role::text in ('delivery', 'company_admin')");
    expect(migration).toContain("DELIVERY_RECEIPT_HAS_SHORTAGES");
    expect(migration).toContain("RECEIPT_ALREADY_CONFIRMED");
    expect(migration).toContain("delivery_shortage_reported");
    expect(migration).toContain("('in_app'::text), ('email'::text)");
    expect(migration).toContain(
      "grant execute on function public.save_service_receipt_check(uuid, jsonb, text) to authenticated",
    );
  });

  it("separa la llegada de despacho de la confirmación de Securitas", () => {
    const migration = readMigration("0020_company_arrival_confirmation.sql");

    expect(migration).toContain("company_arrival_confirmed_at");
    expect(migration).toContain("function public.confirm_company_delivery_arrival");
    expect(migration).toContain("COMPANY_ARRIVAL_REQUIRED");
    expect(migration).toContain("delivery.company_arrival_confirmed");
    expect(migration).toContain(
      "grant execute on function public.confirm_company_delivery_arrival(uuid) to authenticated",
    );
  });
  it("revokes accounts and limits direct delivery access", () => {
    const migration = readMigration("0021_security_hardening.sql");

    expect(migration).toContain("function public.set_provider_access_active");
    expect(migration).toContain("function public.set_worker_account_active");
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("access.account_deactivated");
    expect(migration).toContain("worker.account_deactivated");
    expect(migration).toContain(
      'drop policy if exists "delivery can read organization diners"',
    );
    expect(migration).toContain(
      'drop policy if exists "delivery can read organization orders"',
    );
    expect(migration).toContain(
      "grant execute on function public.set_provider_access_active(uuid, boolean) to authenticated",
    );
  });

  it("requires aal2 for administrative reads, writes and RPC operations", () => {
    const migration = readMigration("0022_admin_totp_mfa.sql");

    expect(migration).toContain("auth.jwt()->>'aal'");
    expect(migration).toContain("function private.require_admin_mfa_for_write");
    expect(migration).toContain("message = 'MFA_REQUIRED'");
    expect(migration).toContain("before insert or update or delete on public.orders");
    expect(migration).toContain("before insert or update or delete on public.profiles");
    expect(migration).toContain("expected_role not in ('company_admin', 'provider_admin')");
  });

  it("marks new training orders as a fixed package without rewriting historical orders", () => {
    const migration = readMigration("0023_training_package.sql");
    expect(migration).toContain("add column training_package boolean not null default false");
    expect(migration).toContain("create trigger orders_apply_training_package");
    expect(migration).toContain("new.side := 'ensalada'");
    expect(migration).toContain("new.bread := true");
    expect(migration).toContain("'complement:juice'");
    expect(migration).toContain("and order_record.training_package");
  });

  it("checks reserved capacity without granting menu edits to workers or Securitas", () => {
    const migration = readMigration("0024_fix_capacity_guard_rls.sql");

    expect(migration).toContain(
      "alter function private.enforce_menu_option_capacity() security definer",
    );
    expect(migration).toContain(
      "alter function private.enforce_menu_option_capacity() set search_path = ''",
    );
    expect(migration).toContain(
      "revoke all on function private.enforce_menu_option_capacity() from public, anon, authenticated",
    );
    expect(migration).not.toContain("create policy");
  });

  it("shows training availability to Securitas without exposing it to workers", () => {
    const migration = readMigration("0025_training_menu_availability.sql");

    expect(migration).toContain("function public.get_menu_option_availability(target_menu_week_id uuid)");
    expect(migration).toContain("menu_option.available_for_training");
    expect(migration).toContain("private.current_user_has_role('company_admin')");
    expect(migration).toContain("menu_option.available_for_workers or");
    expect(migration).toContain("order_record.status = 'confirmed'");
  });

  it("limits the afternoon training reopening to future service dates", () => {
    const migration = readMigration("0026_training_reopening_future_only.sql");

    expect(migration).toContain("private.enforce_order_business_rules()");
    expect(migration).toContain("matches_found <> 1");
    expect(migration).toContain(
      "organization_now::time < time ''14:00'' or target_day.service_date = organization_now::date",
    );
  });

  it("keeps grouped extras atomic and checks quantity when approving late requests", () => {
    const migration = readMigration("0027_grouped_extra_meals.sql");

    expect(migration).toContain("add column quantity integer not null default 1");
    expect(migration).toContain("quantity between 1 and 500");
    expect(migration).toContain("function public.create_extra_order_with_quantity");
    expect(migration).toContain("function public.request_exceptional_order_with_quantity");
    expect(migration).toContain("function public.update_company_operational_order_with_quantity");
    expect(migration).toContain("function public.update_company_extra_request_with_quantity");
    expect(migration).toContain("saved_request.quantity, saved_request.side");
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain("MENU_OPTION_CAPACITY_EXCEEDED");
  });

  it("crea varias preparaciones en una transacción y habilita menús de capacitación por día", () => {
    const batch = readMigration("0028_multiple_extra_preparations.sql");
    const training = readMigration("0029_daily_training_preparations.sql");
    expect(batch).toContain("function public.create_company_extra_batch");
    expect(batch).toContain("function public.create_company_training_batch");
    expect(batch).toContain("create_extra_order_with_quantity");
    expect(batch).toContain("create_training_order(");
    expect(training).toContain("drop index if exists public.menu_options_one_training_menu_per_day");
    expect(training).toContain("function public.set_training_menus_for_day");
    expect(training).toContain("MENU_OPTION_HAS_RESERVATIONS");
  });

  it("ofrece postre diario con cupo atómico para trabajadores", () => {
    const migration = readMigration("0030_daily_worker_dessert.sql");

    expect(migration).toContain("add column dessert_name text");
    expect(migration).toContain("add column dessert_capacity integer");
    expect(migration).toContain("function public.save_menu_week_with_daily_desserts");
    expect(migration).toContain("function public.update_published_menu_week_with_daily_desserts");
    expect(migration).toContain("function public.get_daily_dessert_availability");
    expect(migration).toContain("function private.enforce_daily_dessert_capacity");
    expect(migration).toContain("for update");
    expect(migration).toContain("DAILY_DESSERT_CAPACITY_EXCEEDED");
    expect(migration).toContain("selected_side::text not in ('ensalada', 'fruta', 'postre')");
    expect(migration).toContain(
      "grant execute on function public.get_daily_dessert_availability(uuid) to authenticated",
    );
  });

  it("desactiva fruta durante los días con postre", () => {
    const migration = readMigration("0031_disable_fruit_when_dessert.sql");

    expect(migration).toContain("function private.enforce_order_business_rules");
    expect(migration).toContain("new.kind = ''regular''");
    expect(migration).toContain("new.side = ''fruta''");
    expect(migration).toContain("target_day.dessert_name is not null");
    expect(migration).toContain("FRUIT_NOT_AVAILABLE_WITH_DESSERT");
    expect(migration).toContain("function private.prevent_dessert_with_fruit_reservations");
    expect(migration).toContain("DAILY_DESSERT_CONFLICTS_WITH_FRUIT_RESERVATIONS");
  });

  it("exige pan o té para los pedidos de trabajadores", () => {
    const migration = readMigration("0032_worker_bread_or_tea.sql");

    expect(migration).toContain("function private.enforce_worker_bread_or_tea");
    expect(migration).toContain("new.kind = 'regular'");
    expect(migration).toContain("new.bread = new.tea");
    expect(migration).toContain("if include_bread = include_tea then");
    expect(migration).toContain("WORKER_BREAD_OR_TEA_REQUIRED");
    expect(migration).toContain("public.save_regular_order");
    expect(migration).toContain("orders_check_worker_bread_or_tea");
  });
});

function readMigration(fileName: string) {
  return readFileSync(`${migrationsDirectory}/${fileName}`, "utf8")
    .replace(/\s+/g, " ")
    .trim();
}
