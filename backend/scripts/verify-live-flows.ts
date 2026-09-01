import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "../src/config/env.js";
import { createAdminSupabaseClient } from "../src/lib/supabase.js";
import type { AppRole, Database } from "../src/types/database.js";

const apiUrl = "http://localhost:4000/api/v1";
const admin = createAdminSupabaseClient();
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getSupabaseEnv();
const requiredRoles: AppRole[] = ["worker", "company_admin", "provider_admin", "delivery"];

const { data: profiles, error: profileError } = await admin
  .from("profiles")
  .select("id, role")
  .eq("active", true)
  .in("role", requiredRoles);
if (profileError) throw profileError;

const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw usersError;
const usersById = new Map(usersPage.users.map((user) => [user.id, user]));
const tokens = new Map<AppRole, string>();

for (const role of requiredRoles) {
  const profile = profiles?.find((candidate) => candidate.role === role);
  if (!profile) throw new Error(`Falta un perfil activo para ${role}`);
  const user = usersById.get(profile.id);
  if (!user?.email) throw new Error(`El perfil ${role} no tiene correo Auth`);
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkError) throw linkError;
  const tokenHash = linkData.properties.hashed_token;
  const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (sessionError) throw sessionError;
  if (!sessionData.session?.access_token) throw new Error(`No se pudo crear sesión para ${role}`);
  tokens.set(role, sessionData.session.access_token);
}

for (const role of requiredRoles) {
  const user = await api<{ role: AppRole }>(role, "/auth/me");
  assert(user.role === role, `El backend devolvió ${user.role} para ${role}`);
}

const workerMenu = await api<MenuWeek>("worker", "/menus/current");
const companyMenu = await api<MenuWeek>("company_admin", "/menus/current");
assert(
  workerMenu.days.flatMap((day) => day.options).every((option) => option.availableForWorkers && !option.trainingMenu),
  "El trabajador recibió una alternativa reservada para capacitación",
);
assert(
  companyMenu.days.flatMap((day) => day.options).some((option) => option.trainingMenu && !option.availableForWorkers),
  "Securitas no recibió el menú separado de capacitación",
);

const today = chileDate(new Date());
const reservableDays = workerMenu.days.filter(
  (day) =>
    !day.disabled &&
    day.serviceDate > today &&
    day.options.some((option) => option.visible && option.availableForWorkers),
);
if (!reservableDays.length) {
  throw new Error("No existen días futuros reservables en la semana de prueba");
}

const orders = [];
for (const [dayIndex, day] of reservableDays.entries()) {
  const workerOptions = day.options.filter(
    (option) => option.visible && option.availableForWorkers,
  );
  const workerOption = workerOptions[dayIndex % workerOptions.length];
  if (!workerOption) {
    throw new Error(`No existe una alternativa disponible para ${day.serviceDate}`);
  }

  const order = await api<{ id: string; serviceDayId: string }>(
    "worker",
    "/orders/me",
    {
      method: "PUT",
      body: JSON.stringify({
        serviceDayId: day.id,
        menuOptionId: workerOption.id,
        side: ["ensalada", "postre", "ninguno"][dayIndex % 3],
        bread: dayIndex % 2 === 0,
        tea: dayIndex % 2 !== 0,
      }),
    },
  );
  assert(Boolean(order.id), `No se creó la reserva para ${day.serviceDate}`);
  orders.push(order);
}

const refreshedOrders = await api<{
  orders: Array<{ serviceDayId: string; status: "confirmed" | "cancelled" }>;
}>("worker", "/orders/me");
for (const day of reservableDays) {
  assert(
    refreshedOrders.orders.some(
      (order) => order.serviceDayId === day.id && order.status === "confirmed",
    ),
    `La reserva de ${day.serviceDate} no aparece al volver a consultar`,
  );
}

const reservableDay = reservableDays[0];
const order = orders[0];
assert(reservableDay && order, "No fue posible elegir una reserva de referencia");

await api("provider_admin", `/provider/operations?startsOn=${workerMenu.startsOn}`);
await api("company_admin", `/company/operations?startsOn=${workerMenu.startsOn}`);
await api("provider_admin", `/provider/reports?period=weekly&date=${reservableDay.serviceDate}`);
await api("company_admin", `/company/reports?period=weekly&date=${reservableDay.serviceDate}`);

for (const role of ["provider_admin", "company_admin", "delivery"] as const) {
  const summary = await api<DailySummary>(role, `/summaries/daily?date=${reservableDay.serviceDate}`);
  assert(summary.totals.colations >= 1, `El resumen de ${role} no contiene la reserva`);
  assert(summary.manifest.some((item) => item.orderId === order.id), `El manifiesto de ${role} no contiene la reserva`);
}

const workerSummary = await apiResponse("worker", `/summaries/daily?date=${reservableDay.serviceDate}`);
assert(workerSummary.status === 403, "El trabajador pudo acceder al resumen operacional");

const todayDay = companyMenu.days.find((day) => day.serviceDate === today);
if (todayDay) {
  const regularOption = todayDay.options.find((option) => option.availableForWorkers);
  const trainingOption = todayDay.options.find((option) => option.trainingMenu);
  if (regularOption) {
    const extraResponse = await apiResponse("company_admin", "/company/extras", {
      method: "POST",
      body: JSON.stringify({
        serviceDayId: todayDay.id,
        menuOptionId: regularOption.id,
        beneficiaryLabel: "Visita prueba cierre",
        side: "ensalada",
        bread: true,
        tea: false,
        reason: "Verificación automática del cierre diario",
      }),
    });
    assert(extraResponse.status === 409, `Se esperaba cierre 409 para extra y respondió ${extraResponse.status}`);
  }
  if (trainingOption) {
    const trainingResponse = await apiResponse("company_admin", "/company/training-sessions", {
      method: "POST",
      body: JSON.stringify({
        serviceDayId: todayDay.id,
        menuOptionId: trainingOption.id,
        name: "Capacitación prueba cierre",
        attendeeCount: 2,
        side: "ensalada",
        bread: true,
        tea: false,
      }),
    });
    assert(trainingResponse.status === 409, `Se esperaba cierre 409 para capacitación y respondió ${trainingResponse.status}`);
  }
}

console.log("Flujo remoto verificado para worker, company_admin, provider_admin y delivery.");
console.log(
  `${orders.length} reservas semanales confirmadas para el usuario trabajador de prueba.`,
);
console.log("Menú de capacitación aislado, resúmenes compartidos y permisos validados.");
console.log("Cierre de operaciones fuera de horario validado sin crear registros tardíos.");
console.log("Tokens y correos ocultos.");

async function api<T = unknown>(role: AppRole, path: string, init: RequestInit = {}) {
  const response = await apiResponse(role, path, init);
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(`${role} ${path}: ${payload.error?.message ?? response.statusText}`);
  return payload.data as T;
}

function apiResponse(role: AppRole, path: string, init: RequestInit = {}) {
  const token = tokens.get(role);
  if (!token) throw new Error(`No existe token de prueba para ${role}`);
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function chileDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type MenuWeek = {
  startsOn: string;
  days: Array<{
    id: string;
    serviceDate: string;
    disabled: boolean;
    options: Array<{
      id: string;
      visible: boolean;
      trainingMenu: boolean;
      availableForWorkers: boolean;
    }>;
  }>;
};

type DailySummary = {
  totals: { colations: number };
  manifest: Array<{ orderId: string }>;
};
