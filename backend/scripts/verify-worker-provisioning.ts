import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "../src/config/env.js";
import { createAdminSupabaseClient } from "../src/lib/supabase.js";
import type { Database } from "../src/types/database.js";

const admin = createAdminSupabaseClient();
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getSupabaseEnv();
const email = `provision-${Date.now().toString(36)}@sn-colaciones.test`;
let createdDinerId: string | null = null;
let createdAuthId: string | null = null;
let failed = false;

try {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "company_admin")
    .eq("active", true)
    .limit(1)
    .single();
  if (profileError) throw profileError;

  const { data: companyUser, error: companyUserError } =
    await admin.auth.admin.getUserById(profile.id);
  if (companyUserError || !companyUser.user.email) {
    throw companyUserError ?? new Error("La administradora Securitas no tiene correo");
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: companyUser.user.email,
  });
  if (linkError) throw linkError;
  const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: sessionError } = await authClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (sessionError || !session.session?.access_token) {
    throw sessionError ?? new Error("No se pudo crear la sesión administrativa");
  }
  const token = session.session.access_token;

  const workers = await api<WorkerAccount[]>("/company/workers", token);
  const unlinkedWorker = workers.find((worker) => worker.active && !worker.accountCreated);
  if (!unlinkedWorker) throw new Error("No existe un trabajador sin cuenta para la prueba");
  createdDinerId = unlinkedWorker.id;

  const created = await api<WorkerAccount>("/company/workers", token, {
    method: "POST",
    body: JSON.stringify({ dinerId: unlinkedWorker.id, email }),
  });
  if (!created.accountCreated || created.email !== email) {
    throw new Error("La API no devolvió la cuenta recién creada");
  }

  const authUsers = await listAllAuthUsers();
  createdAuthId = authUsers.find((user) => user.email === email)?.id ?? null;
  if (!createdAuthId) throw new Error("La cuenta Auth no fue creada");

  const refreshedWorkers = await api<WorkerAccount[]>("/company/workers", token);
  const refreshed = refreshedWorkers.find((worker) => worker.id === created.id);
  if (!refreshed?.accountCreated || refreshed.email !== email) {
    throw new Error("La cuenta creada no aparece en la nómina actualizada");
  }

  console.log("Creación de trabajadores verificada mediante la API de Securitas.");
  console.log("Cuenta Auth, perfil, vínculo con nómina y listado posterior: correctos.");
  console.log("Correo y credenciales ocultos.");
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : "La verificación falló");
} finally {
  try {
    if (createdDinerId) {
      await admin.from("diners").update({ auth_user_id: null }).eq("id", createdDinerId);
    }
    if (!createdAuthId) {
      createdAuthId = (await listAllAuthUsers()).find((user) => user.email === email)?.id ?? null;
    }
    if (createdAuthId) {
      await admin.from("audit_events").delete().eq("actor_id", createdAuthId);
      await admin.from("profiles").delete().eq("id", createdAuthId);
      const { error } = await admin.auth.admin.deleteUser(createdAuthId);
      if (error) {
        failed = true;
        console.error(`No se pudo eliminar la cuenta Auth temporal: ${error.message}`);
      }
    }
    console.log("Cuenta temporal de verificación eliminada.");
  } catch (error) {
    failed = true;
    console.error(
      `No se pudo limpiar la cuenta temporal: ${error instanceof Error ? error.message : "error desconocido"}`,
    );
  }
}

if (failed) process.exitCode = 1;

async function api<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`http://localhost:4000/api/v1${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? `La API respondió ${response.status}`);
  }
  return payload.data;
}

async function listAllAuthUsers() {
  const users: Array<{ id: string; email?: string }> = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

type WorkerAccount = {
  id: string;
  fullName: string;
  email: string | null;
  accountCreated: boolean;
  active: boolean;
};
