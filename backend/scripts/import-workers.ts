import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { AppError } from "../src/errors/app-error.js";
import { createAdminSupabaseClient } from "../src/lib/supabase.js";

const execFileAsync = promisify(execFile);
const extractorPath = fileURLToPath(new URL("./extract-workers.ps1", import.meta.url));

const options = parseArguments(process.argv.slice(2));
if (!options.file || !options.sheet) {
  throw new Error(
    "Uso: npm run import:workers -w backend -- --file <archivo.xlsx> --sheet <hoja> [--organization <nombre>] [--apply]",
  );
}
if (!existsSync(options.file)) {
  throw new Error(`No existe el archivo indicado: ${options.file}`);
}

const rawNames = await extractNames(options.file, options.sheet);
const preview = prepareWorkerNames(rawNames);
const supabase = createAdminSupabaseClient();
const { data: organizations, error: organizationLookupError } = await supabase
  .from("organizations")
  .select("id, name")
  .eq("name", options.organization)
  .limit(2);
if (organizationLookupError) throw organizationLookupError;
if ((organizations?.length ?? 0) > 1) {
  throw new AppError(
    "Existe más de una organización con el mismo nombre",
    409,
    "DUPLICATE_ORGANIZATION",
  );
}

const existingOrganization = organizations?.[0] ?? null;
const existingWorkers = existingOrganization
  ? await loadExistingWorkers(existingOrganization.id)
  : [];
const existingKeys = new Set(existingWorkers.map((worker) => comparableName(worker.full_name)));
const newWorkers = preview.names.filter((name) => !existingKeys.has(comparableName(name)));

console.log(`Organización: ${options.organization}`);
console.log(`Hoja analizada: ${options.sheet}`);
console.log(`Filas con texto: ${rawNames.length}`);
console.log(`Trabajadores únicos válidos: ${preview.names.length}`);
console.log(`Etiquetas excluidas: ${preview.excluded.length}`);
console.log(`Duplicados normalizados: ${preview.duplicates.length}`);
console.log(`Ya registrados: ${existingWorkers.length}`);
console.log(`Nuevos por registrar: ${newWorkers.length}`);

for (const [index, name] of preview.names.entries()) {
  const state = existingKeys.has(comparableName(name)) ? "existente" : "nuevo";
  console.log(`${String(index + 1).padStart(2, "0")}. ${name} [${state}]`);
}

if (!options.apply) {
  console.log("Vista previa terminada. No se modificó Supabase.");
  console.log("Agrega --apply para crear la organización e importar sólo los nombres nuevos.");
} else {
  const organization =
    existingOrganization ?? (await createOrganization(options.organization));
  if (newWorkers.length > 0) {
    const { error } = await supabase.from("diners").insert(
      newWorkers.map((fullName) => ({
        organization_id: organization.id,
        full_name: fullName,
        type: "worker" as const,
        active: true,
      })),
    );
    if (error) throw error;
  }

  console.log(
    `Importación completada: organización ${organization.id}, ${newWorkers.length} trabajadores nuevos.`,
  );
  console.log("No se crearon cuentas de acceso ni se enviaron correos.");
}

async function extractNames(excelPath: string, sheetName: string) {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      extractorPath,
      "-ExcelPath",
      excelPath,
      "-SheetName",
      sheetName,
    ],
    { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 },
  );
  const parsed: unknown = JSON.parse(stdout.trim());
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    throw new Error("El extractor de Excel devolvió un formato inesperado");
  }
  return parsed as string[];
}

function prepareWorkerNames(rawNames: string[]) {
  const names: string[] = [];
  const excluded: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const rawName of rawNames) {
    const compactName = rawName.replace(/\s+/g, " ").trim();
    if (shouldExclude(compactName)) {
      excluded.push(compactName);
      continue;
    }

    const displayName = titleCaseName(compactName);
    const key = comparableName(displayName);
    if (seen.has(key)) {
      duplicates.push(compactName);
      continue;
    }
    seen.add(key);
    names.push(displayName);
  }

  return { names, excluded, duplicates };
}

function shouldExclude(value: string) {
  const key = comparableName(value);
  if (value.length > 120) return true;
  if (key.split(" ").length < 2) return true;
  return /^(NOMBRE|NOMBRES|EXTRA|TOTAL|CAPACITACION|ALUMNO|ALUMNOS|INVITADO|INVITADOS)( |$)/u.test(
    key,
  );
}

function comparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .toLocaleUpperCase("es-CL");
}

function titleCaseName(value: string) {
  const lowercaseWords = new Set(["de", "del", "la", "las", "los", "y"]);
  return value
    .toLocaleLowerCase("es-CL")
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && lowercaseWords.has(word)
        ? word
        : `${word.charAt(0).toLocaleUpperCase("es-CL")}${word.slice(1)}`,
    )
    .join(" ");
}

async function loadExistingWorkers(organizationId: string) {
  const { data, error } = await supabase
    .from("diners")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .eq("type", "worker");
  if (error) throw error;
  return data ?? [];
}

async function createOrganization(name: string) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, timezone: "America/Santiago" })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

function parseArguments(argumentsList: string[]) {
  const parsed = {
    file: "",
    sheet: "",
    organization: "Securitas Concepción",
    apply: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--apply") {
      parsed.apply = true;
      continue;
    }
    const value = argumentsList[index + 1];
    if (!value) throw new Error(`Falta un valor para ${argument}`);
    if (argument === "--file") parsed.file = value;
    else if (argument === "--sheet") parsed.sheet = value;
    else if (argument === "--organization") parsed.organization = value.trim();
    else throw new Error(`Argumento desconocido: ${argument}`);
    index += 1;
  }

  return parsed;
}
