import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { ProviderManagedRole } from "../schemas/provider-access.schema.js";
import type { Database } from "../types/database.js";

type AdminClient = SupabaseClient<Database>;
const MANAGED_ROLES: ProviderManagedRole[] = ["delivery", "company_admin"];

export async function listProviderAccessAccounts(
  admin: AdminClient,
  organizationId: string,
) {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .eq("organization_id", organizationId)
    .in("role", MANAGED_ROLES)
    .order("full_name", { ascending: true });
  if (error) throwSupabaseError(error, "No fue posible consultar los accesos");

  const users = await listAllAuthUsers(admin);
  const userById = new Map(users.map((user) => [user.id, user]));

  return (profiles ?? []).map((profile) => {
    const authUser = userById.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: authUser?.email ?? null,
      role: profile.role as ProviderManagedRole,
      accessActivated: Boolean(authUser?.email_confirmed_at),
      active: profile.active,
      createdAt: profile.created_at,
    };
  });
}

export async function createProviderAccessAccount(
  admin: AdminClient,
  organizationId: string,
  input: {
    email: string;
    fullName: string;
    role: ProviderManagedRole;
    actorId: string;
    passwordSetupRedirectTo: string;
  },
) {
  const email = input.email.trim().toLocaleLowerCase("es-CL");
  const fullName = input.fullName.trim();
  const existingAuthUser = await findAuthUserByEmail(admin, email);
  if (existingAuthUser) {
    throw new AppError(
      "El correo ya pertenece a una cuenta del sistema",
      409,
      "EMAIL_ALREADY_REGISTERED",
    );
  }

  let authUserId: string | null = null;
  try {
    const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName, role: input.role },
        redirectTo: input.passwordSetupRedirectTo,
      },
    );
    if (authError) {
      throw new AppError(
        "No fue posible crear el acceso",
        authError.status === 422 ? 409 : 503,
        authError.status === 422 ? "EMAIL_ALREADY_REGISTERED" : "AUTH_USER_CREATE_FAILED",
      );
    }
    authUserId = authData.user.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .insert({
        id: authUserId,
        organization_id: organizationId,
        full_name: fullName,
        role: input.role,
        active: true,
      })
      .select("id, full_name, role, active, created_at")
      .single();
    if (profileError) throwSupabaseError(profileError, "No fue posible crear el perfil de acceso");

    const { error: auditError } = await admin.from("audit_events").insert({
      organization_id: organizationId,
      actor_id: input.actorId,
      entity_type: "profile",
      entity_id: profile.id,
      action: "access.account_created",
      metadata: { role: input.role },
    });
    if (auditError) throwSupabaseError(auditError, "No fue posible auditar la cuenta");

    return {
      id: profile.id,
      fullName: profile.full_name,
      email,
      role: profile.role as ProviderManagedRole,
      accessActivated: false,
      active: profile.active,
      createdAt: profile.created_at,
    };
  } catch (error) {
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
    throw error;
  }
}

export async function sendProviderAccessPasswordSetupEmail(
  admin: AdminClient,
  organizationId: string,
  accessUserId: string,
  actorId: string,
  redirectTo: string,
) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, active")
    .eq("id", accessUserId)
    .eq("organization_id", organizationId)
    .in("role", MANAGED_ROLES)
    .maybeSingle();
  if (profileError) throwSupabaseError(profileError, "No fue posible consultar el acceso");
  if (!profile?.active) {
    throw new AppError("No se encontró un acceso activo", 404, "ACCESS_ACCOUNT_NOT_FOUND");
  }

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);
  if (authError || !authData.user?.email) {
    throw new AppError("No fue posible consultar el correo de acceso", 503, "AUTH_USER_READ_FAILED");
  }

  const { error: auditError } = await admin.from("audit_events").insert({
    organization_id: organizationId,
    actor_id: actorId,
    entity_type: "profile",
    entity_id: profile.id,
    action: "access.password_setup_requested",
    metadata: {},
  });
  if (auditError) throwSupabaseError(auditError, "No fue posible auditar el reenvio");

  const { error: emailError } = await admin.auth.resetPasswordForEmail(
    authData.user.email,
    { redirectTo },
  );
  if (emailError) {
    throw new AppError(
      emailError.status === 429
        ? "Espera unos minutos antes de reenviar el correo"
        : "No fue posible enviar el correo para crear la contraseña",
      emailError.status === 429 ? 429 : 503,
      emailError.status === 429 ? "AUTH_EMAIL_RATE_LIMITED" : "AUTH_EMAIL_SEND_FAILED",
    );
  }

  return { email: authData.user.email };
}

export async function setProviderAccessAccountActive(
  supabase: AdminClient,
  accessUserId: string,
  active: boolean,
) {
  const { data, error } = await supabase.rpc("set_provider_access_active", {
    target_profile_id: accessUserId,
    is_active: active,
  });
  if (error) throwSupabaseError(error, "No fue posible actualizar el acceso");
  return { id: data.id, active: data.active };
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const users = await listAllAuthUsers(admin);
  return users.find((user) => user.email?.toLocaleLowerCase("es-CL") === email);
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
