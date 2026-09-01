import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database } from "../types/database.js";

type AdminClient = SupabaseClient<Database>;

export async function listWorkerAccounts(
  admin: AdminClient,
  organizationId: string,
) {
  const { data: diners, error } = await admin
    .from("diners")
    .select("id, full_name, employee_code, auth_user_id, active, created_at")
    .eq("organization_id", organizationId)
    .eq("type", "worker")
    .order("full_name", { ascending: true });
  if (error) throwSupabaseError(error, "No fue posible consultar los trabajadores");

  const users = await listAllAuthUsers(admin);
  const emailById = new Map(users.map((user) => [user.id, user.email ?? null]));

  return (diners ?? []).map((diner) => ({
    id: diner.id,
    fullName: diner.full_name,
    employeeCode: diner.employee_code,
    email: diner.auth_user_id ? emailById.get(diner.auth_user_id) ?? null : null,
    accountCreated: Boolean(diner.auth_user_id),
    active: diner.active,
    createdAt: diner.created_at,
  }));
}

export async function createWorkerAccount(
  admin: AdminClient,
  organizationId: string,
  input: {
    email: string;
    dinerId?: string;
    fullName?: string;
    employeeCode?: string;
  },
) {
  const email = input.email.trim().toLocaleLowerCase("es-CL");
  const existingAuthUser = await findAuthUserByEmail(admin, email);
  if (existingAuthUser) {
    throw new AppError(
      "El correo ya pertenece a una cuenta del sistema",
      409,
      "EMAIL_ALREADY_REGISTERED",
    );
  }

  const existingDiner = input.dinerId
    ? await getAvailableDiner(admin, organizationId, input.dinerId)
    : null;
  const fullName = existingDiner?.full_name ?? input.fullName?.trim();
  if (!fullName) {
    throw new AppError(
      "Debes indicar el nombre del trabajador",
      422,
      "WORKER_NAME_REQUIRED",
    );
  }

  let authUserId: string | null = null;
  let profileCreated = false;
  let dinerCreatedId: string | null = null;
  let existingDinerLinked = false;

  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "worker" },
    });
    if (authError) {
      throw new AppError(
        "No fue posible crear el acceso del trabajador",
        authError.status === 422 ? 409 : 503,
        authError.status === 422 ? "EMAIL_ALREADY_REGISTERED" : "AUTH_USER_CREATE_FAILED",
      );
    }
    authUserId = authData.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: authUserId,
      organization_id: organizationId,
      full_name: fullName,
      role: "worker",
      active: true,
    });
    if (profileError) throwSupabaseError(profileError, "No fue posible crear el perfil");
    profileCreated = true;

    if (existingDiner) {
      const { data: linkedDiner, error: linkError } = await admin
        .from("diners")
        .update({ auth_user_id: authUserId })
        .eq("id", existingDiner.id)
        .is("auth_user_id", null)
        .select("id")
        .maybeSingle();
      if (linkError) throwSupabaseError(linkError, "No fue posible vincular al trabajador");
      if (!linkedDiner) {
        throw new AppError(
          "El trabajador ya fue vinculado por otra operación",
          409,
          "WORKER_ALREADY_LINKED",
        );
      }
      existingDinerLinked = true;
    } else {
      const { data: diner, error: dinerError } = await admin
        .from("diners")
        .insert({
          organization_id: organizationId,
          auth_user_id: authUserId,
          full_name: fullName,
          type: "worker",
          employee_code: input.employeeCode?.trim() || null,
          active: true,
        })
        .select("id")
        .single();
      if (dinerError) throwSupabaseError(dinerError, "No fue posible crear al trabajador");
      dinerCreatedId = diner.id;
    }

    return {
      id: existingDiner?.id ?? dinerCreatedId!,
      fullName,
      employeeCode: existingDiner?.employee_code ?? input.employeeCode?.trim() ?? null,
      email,
      accountCreated: true,
      active: true,
      createdAt: existingDiner?.created_at ?? new Date().toISOString(),
    };
  } catch (error) {
    if (existingDinerLinked && existingDiner) {
      await admin.from("diners").update({ auth_user_id: null }).eq("id", existingDiner.id);
    }
    if (dinerCreatedId) {
      await admin.from("diners").delete().eq("id", dinerCreatedId);
    }
    if (profileCreated && authUserId) {
      await admin.from("profiles").delete().eq("id", authUserId);
    }
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    throw error;
  }
}

async function getAvailableDiner(
  admin: AdminClient,
  organizationId: string,
  dinerId: string,
) {
  const { data, error } = await admin
    .from("diners")
    .select("id, full_name, employee_code, auth_user_id, active, created_at")
    .eq("id", dinerId)
    .eq("organization_id", organizationId)
    .eq("type", "worker")
    .maybeSingle();
  if (error) throwSupabaseError(error, "No fue posible consultar al trabajador");
  if (!data || !data.active) {
    throw new AppError("No se encontró un trabajador activo", 404, "WORKER_NOT_FOUND");
  }
  if (data.auth_user_id) {
    throw new AppError(
      "El trabajador ya tiene una cuenta vinculada",
      409,
      "WORKER_ALREADY_LINKED",
    );
  }
  return data;
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const users = await listAllAuthUsers(admin);
  return users.find(
    (user) => user.email?.toLocaleLowerCase("es-CL") === email,
  );
}

async function listAllAuthUsers(admin: AdminClient) {
  const users: User[] = [];
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new AppError(
        "No fue posible consultar las cuentas de acceso",
        503,
        "AUTH_USERS_LIST_FAILED",
      );
    }
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}
