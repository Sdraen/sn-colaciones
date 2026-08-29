import { z } from "zod";
import { AppError } from "../src/errors/app-error.js";
import { createAdminSupabaseClient } from "../src/lib/supabase.js";
import type { AppRole } from "../src/types/database.js";

const inputSchema = z
  .object({
    email: z.email().transform((value) => value.trim().toLocaleLowerCase("es-CL")),
    fullName: z.string().trim().min(3).max(120),
    role: z.enum(["worker", "company_admin", "provider_admin"]),
    organization: z.string().trim().min(2).max(120).default("Securitas Concepción"),
    workerName: z.string().trim().min(3).max(120).optional(),
    apply: z.boolean().default(false),
  })
  .superRefine((input, context) => {
    if (input.role === "worker" && !input.workerName) {
      context.addIssue({
        code: "custom",
        path: ["workerName"],
        message: "Un trabajador requiere --worker-name para vincular su registro importado",
      });
    }
    if (input.role !== "worker" && input.workerName) {
      context.addIssue({
        code: "custom",
        path: ["workerName"],
        message: "--worker-name sólo corresponde al rol worker",
      });
    }
  });

const input = inputSchema.parse(parseArguments(process.argv.slice(2)));
const supabase = createAdminSupabaseClient();

const { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("id, name")
  .eq("name", input.organization)
  .maybeSingle();
if (organizationError) throw organizationError;
if (!organization) {
  throw new AppError("No existe la organización indicada", 404, "ORGANIZATION_NOT_FOUND");
}

const authUser = await findAuthUserByEmail(input.email);
const existingProfile = authUser ? await findProfile(authUser.id) : null;
const worker = input.role === "worker" ? await findWorker(organization.id, input.workerName!) : null;

validateExistingState({
  authUserId: authUser?.id,
  existingProfile,
  organizationId: organization.id,
  role: input.role,
  worker,
});

console.log(`Organización: ${organization.name}`);
console.log(`Correo: ${input.email}`);
console.log(`Nombre: ${input.fullName}`);
console.log(`Rol: ${input.role}`);
console.log(`Cuenta Auth: ${authUser ? "existente" : "por crear"}`);
console.log(`Perfil: ${existingProfile ? "existente y compatible" : "por crear"}`);
if (worker) console.log(`Trabajador vinculado: ${worker.full_name}`);

if (!input.apply) {
  console.log("Vista previa terminada. No se modificó Supabase.");
  console.log("Agrega --apply para crear o completar esta cuenta.");
} else {
  await applyProvisioning();
}

async function applyProvisioning() {
  let userId = authUser?.id;
  let createdAuthUser = false;
  let createdProfile = false;

  try {
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      });
      if (error) throw error;
      userId = data.user.id;
      createdAuthUser = true;
    }

    if (!existingProfile) {
      const { error } = await supabase.from("profiles").insert({
        id: userId,
        organization_id: organization.id,
        full_name: input.fullName,
        role: input.role,
        active: true,
      });
      if (error) throw error;
      createdProfile = true;
    }

    if (worker && worker.auth_user_id !== userId) {
      const { error } = await supabase
        .from("diners")
        .update({ auth_user_id: userId })
        .eq("id", worker.id);
      if (error) throw error;
    }

    console.log(`Cuenta provisionada correctamente: ${userId}`);
    console.log("No se envió correo. La persona puede solicitar su enlace desde /login.");
  } catch (error) {
    if (createdAuthUser && userId) {
      await supabase.auth.admin.deleteUser(userId);
    } else if (createdProfile && userId) {
      await supabase.from("profiles").delete().eq("id", userId);
    }
    throw error;
  }
}

async function findAuthUserByEmail(email: string) {
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLocaleLowerCase("es-CL") === email,
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

async function findProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role, active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findWorker(organizationId: string, workerName: string) {
  const { data, error } = await supabase
    .from("diners")
    .select("id, full_name, auth_user_id")
    .eq("organization_id", organizationId)
    .eq("type", "worker")
    .eq("active", true);
  if (error) throw error;

  const key = comparableName(workerName);
  const matches = (data ?? []).filter((candidate) => comparableName(candidate.full_name) === key);
  if (matches.length === 0) {
    throw new AppError(
      "El trabajador no aparece en la nómina importada",
      404,
      "WORKER_NOT_FOUND",
    );
  }
  if (matches.length > 1) {
    throw new AppError(
      "El nombre coincide con más de un trabajador; corrige la nómina antes de continuar",
      409,
      "AMBIGUOUS_WORKER",
    );
  }
  return matches[0];
}

function validateExistingState({
  authUserId,
  existingProfile,
  organizationId,
  role,
  worker,
}: {
  authUserId?: string;
  existingProfile: Awaited<ReturnType<typeof findProfile>>;
  organizationId: string;
  role: AppRole;
  worker: Awaited<ReturnType<typeof findWorker>> | null;
}) {
  if (
    existingProfile &&
    (existingProfile.organization_id !== organizationId || existingProfile.role !== role)
  ) {
    throw new AppError(
      "El correo ya tiene un perfil con otra organización o rol",
      409,
      "PROFILE_CONFLICT",
    );
  }
  if (existingProfile && !existingProfile.active) {
    throw new AppError("El perfil existente está desactivado", 409, "PROFILE_INACTIVE");
  }
  if (worker?.auth_user_id && worker.auth_user_id !== authUserId) {
    throw new AppError(
      "El trabajador ya está vinculado a otra cuenta",
      409,
      "WORKER_ALREADY_LINKED",
    );
  }
}

function comparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .toLocaleUpperCase("es-CL");
}

function parseArguments(argumentsList: string[]) {
  const parsed: Record<string, string | boolean> = { apply: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--apply") {
      parsed.apply = true;
      continue;
    }
    const value = argumentsList[index + 1];
    if (!value) throw new Error(`Falta un valor para ${argument}`);
    if (argument === "--email") parsed.email = value;
    else if (argument === "--name") parsed.fullName = value;
    else if (argument === "--role") parsed.role = value;
    else if (argument === "--organization") parsed.organization = value;
    else if (argument === "--worker-name") parsed.workerName = value;
    else throw new Error(`Argumento desconocido: ${argument}`);
    index += 1;
  }
  return parsed;
}
