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
});

function readMigration(fileName: string) {
  return readFileSync(`${migrationsDirectory}/${fileName}`, "utf8")
    .replace(/\s+/g, " ")
    .trim();
}
