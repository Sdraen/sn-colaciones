import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "../src/config/env.js";
import { createAdminSupabaseClient } from "../src/lib/supabase.js";
import type { Database } from "../src/types/database.js";

const workerCount = boundedInteger(process.env.LOAD_TEST_WORKERS, 80, 1, 200);
const concurrency = boundedInteger(process.env.LOAD_TEST_CONCURRENCY, 10, 1, 30);
const authIntervalMs = boundedInteger(
  process.env.LOAD_TEST_AUTH_INTERVAL_MS,
  2100,
  0,
  10_000,
);
const apiUrl = (process.env.LOAD_TEST_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const keepData = process.env.LOAD_TEST_KEEP_DATA === "true";
const cleanupOnly = process.argv.includes("--cleanup-only");
const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const sharedPassword = `Sn-${randomBytes(18).toString("base64url")}!`;
const admin = createAdminSupabaseClient();
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getSupabaseEnv();

const createdAuthIds: string[] = [];
const createdDinerIds: string[] = [];
let testFailed = false;

try {
  await assertBackendAvailable();
  await cleanupStaleLoadTestData();
  if (cleanupOnly) {
    console.log("Limpieza de bots de carga terminada.");
  } else {
    const organizationId = await getOrganizationId();

  console.log(`Prueba iniciada: ${workerCount} trabajadores, concurrencia ${concurrency}.`);
  console.log("Creando cuentas temporales sin enviar correos...");

  const authResults = await mapLimit(
    Array.from({ length: workerCount }, (_, index) => index + 1),
    Math.min(concurrency, 8),
    async (index) => {
      const email = `load-${runId}-${String(index).padStart(3, "0")}@sn-colaciones.test`;
      const fullName = `Bot Colación ${String(index).padStart(3, "0")}`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: sharedPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, load_test_run: runId },
      });
      if (error) throw new Error(`No se pudo crear el bot ${index}: ${error.message}`);
      createdAuthIds.push(data.user.id);
      return { id: data.user.id, email, fullName, index };
    },
  );

  const { error: profileError } = await admin.from("profiles").insert(
    authResults.map((bot) => ({
      id: bot.id,
      organization_id: organizationId,
      full_name: bot.fullName,
      role: "worker" as const,
      active: true,
    })),
  );
  if (profileError) throw new Error(`No se pudieron crear los perfiles: ${profileError.message}`);

  const { data: diners, error: dinerError } = await admin
    .from("diners")
    .insert(
      authResults.map((bot) => ({
        organization_id: organizationId,
        auth_user_id: bot.id,
        full_name: bot.fullName,
        type: "worker" as const,
        employee_code: `LOAD-${runId}-${bot.index}`,
        active: true,
      })),
    )
    .select("id, auth_user_id");
  if (dinerError) throw new Error(`No se pudieron crear los comensales: ${dinerError.message}`);
  createdDinerIds.push(...(diners ?? []).map((diner) => diner.id));

  console.log(
    `Autenticando bots con separación de ${authIntervalMs} ms para respetar el límite de Supabase...`,
  );
  const sessionResults: AuthenticatedBotResult[] = [];
  const authFailures: FailureResult[] = [];
  for (let index = 0; index < authResults.length; index += 1) {
    if (index > 0 && authIntervalMs > 0) await delay(authIntervalMs);
    const result = await authenticateBot(authResults[index]);
    if (result.ok) sessionResults.push(result);
    else authFailures.push(result);
    if ((index + 1) % 10 === 0 || index + 1 === authResults.length) {
      console.log(`- ${index + 1}/${authResults.length} sesiones procesadas`);
    }
  }

  if (!sessionResults.length) {
    throw new Error("Ningún bot pudo iniciar sesión");
  }
  const planningMenu = await apiRequest<WorkerOrdersPayload>(
    "/orders/me",
    sessionResults[0].token,
  );
  if (!planningMenu.ok || !planningMenu.data) {
    throw new Error(`No fue posible preparar la distribución semanal: ${planningMenu.error}`);
  }
  const plannedDays = reservableDaysFrom(planningMenu.data);
  if (plannedDays.length < 2) {
    throw new Error("Se requieren al menos dos días reservables para probar una semana");
  }
  const optionAssignments = await planOptionAssignments(plannedDays, workerCount);

  console.log(`Ejecutando consultas y reservas semanales con concurrencia ${concurrency}...`);
  const apiFlowResults = await mapLimit(sessionResults, concurrency, async (bot) => {
    const flowStartedAt = performance.now();
    const menuStartedAt = performance.now();
    const menuResponse = await apiRequest<WorkerOrdersPayload>("/orders/me", bot.token);
    const menuMs = performance.now() - menuStartedAt;
    if (!menuResponse.ok || !menuResponse.data) {
      return failureResult(bot.index, "menu", menuResponse.error, performance.now() - flowStartedAt);
    }

    const reservableDays = reservableDaysFrom(menuResponse.data);
    if (reservableDays.length < 2) {
      return failureResult(
        bot.index,
        "menu",
        "Se requieren al menos dos días reservables para probar una semana",
        performance.now() - flowStartedAt,
      );
    }

    const orderStartedAt = performance.now();
    for (const [dayIndex, day] of reservableDays.entries()) {
      const options = day.options.filter(
        (option) => option.visible && option.availableForWorkers,
      );
      const assignedOptionId = optionAssignments.get(day.id)?.[bot.index - 1];
      const option = options.find((candidate) => candidate.id === assignedOptionId);
      if (!option) {
        return failureResult(
          bot.index,
          "menu",
          `No existe una preparación disponible para el día ${dayIndex + 1}`,
          performance.now() - flowStartedAt,
        );
      }

      const orderResponse = await apiRequest<{ id: string }>("/orders/me", bot.token, {
        method: "PUT",
        body: JSON.stringify({
          serviceDayId: day.id,
          menuOptionId: option.id,
          side: ["ensalada", "postre", "ninguno"][(bot.index + dayIndex) % 3],
          bread: (bot.index + dayIndex) % 2 === 0,
          tea: (bot.index + dayIndex) % 2 !== 0,
        }),
      });
      if (!orderResponse.ok || !orderResponse.data?.id) {
        return failureResult(
          bot.index,
          `pedido_dia_${dayIndex + 1}`,
          orderResponse.error,
          performance.now() - flowStartedAt,
        );
      }
    }
    const orderMs = performance.now() - orderStartedAt;

    const verificationResponse = await apiRequest<WorkerOrdersPayload>(
      "/orders/me",
      bot.token,
    );
    const reservableDayIds = new Set(reservableDays.map((day) => day.id));
    const confirmedOrders = verificationResponse.data?.orders.filter(
      (order) => order.status === "confirmed" && reservableDayIds.has(order.serviceDayId),
    ).length;
    if (!verificationResponse.ok || confirmedOrders !== reservableDays.length) {
      return failureResult(
        bot.index,
        "verification",
        verificationResponse.error ??
          `Se esperaban ${reservableDays.length} pedidos y se encontraron ${confirmedOrders ?? 0}`,
        performance.now() - flowStartedAt,
      );
    }

    return {
      ok: true as const,
      index: bot.index,
      authMs: bot.authMs,
      authRetries: bot.authRetries,
      menuMs,
      orderMs,
      orderCount: reservableDays.length,
      totalMs: bot.authMs + performance.now() - flowStartedAt,
    };
  });
  const flowResults = [...apiFlowResults, ...authFailures];

  const successes = flowResults.filter((result) => result.ok);
  const failures = flowResults.filter((result) => !result.ok);
  const expectedOrders = successes.reduce((sum, result) => sum + result.orderCount, 0);
  const { count: storedOrders, error: orderCountError } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("diner_id", createdDinerIds)
    .eq("status", "confirmed");
  if (orderCountError) throw new Error(`No se pudo verificar el total: ${orderCountError.message}`);

  console.log("");
  console.log("Resultado de carga");
  console.log(`- Flujos exitosos: ${successes.length}/${workerCount}`);
  console.log(`- Pedidos semanales esperados: ${expectedOrders}`);
  console.log(`- Pedidos confirmados en base de datos: ${storedOrders ?? 0}`);
  console.log(`- Autenticación p50/p95: ${percentile(successes, "authMs", 50)} ms / ${percentile(successes, "authMs", 95)} ms`);
  console.log(`- Reintentos por límite de Auth: ${successes.reduce((sum, result) => sum + result.authRetries, 0)}`);
  console.log(`- Consulta de menú p50/p95: ${percentile(successes, "menuMs", 50)} ms / ${percentile(successes, "menuMs", 95)} ms`);
  console.log(`- Reserva semanal p50/p95: ${percentile(successes, "orderMs", 50)} ms / ${percentile(successes, "orderMs", 95)} ms`);
  console.log(`- Flujo completo p50/p95/máx.: ${percentile(successes, "totalMs", 50)} ms / ${percentile(successes, "totalMs", 95)} ms / ${maximum(successes, "totalMs")} ms`);

  if (failures.length) {
    const grouped = new Map<string, number>();
    for (const failure of failures) {
      const key = `${failure.stage}: ${failure.error}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    console.log("- Errores:");
    for (const [error, count] of grouped) console.log(`  ${count} × ${error}`);
  }

  if (successes.length !== workerCount || storedOrders !== expectedOrders) {
    testFailed = true;
    throw new Error("La prueba no alcanzó el 100% de solicitudes confirmadas");
  }

    console.log(
      `Prueba aprobada: los ${workerCount} trabajadores reservaron todos los días disponibles de su semana.`,
    );
  }
} catch (error) {
  testFailed = true;
  console.error(error instanceof Error ? error.message : "La prueba de carga falló");
} finally {
  if (keepData) {
    console.log(`Datos temporales conservados intencionalmente. Identificador: ${runId}`);
  } else {
    try {
      await cleanup();
      console.log("Limpieza completa: no se conservaron bots ni pedidos de prueba.");
    } catch (error) {
      testFailed = true;
      console.error(
        `La limpieza automática falló para ${runId}: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
    }
  }
}

if (testFailed) process.exitCode = 1;

async function assertBackendAvailable() {
  const healthUrl = new URL("../health", `${apiUrl}/`);
  const response = await fetch(healthUrl);
  if (!response.ok) throw new Error(`El backend no está disponible en ${healthUrl.origin}`);
}

async function getOrganizationId() {
  const { data, error } = await admin.from("organizations").select("id").limit(2);
  if (error) throw new Error(`No se pudo consultar la organización: ${error.message}`);
  if (data.length !== 1) {
    throw new Error("La prueba requiere exactamente una organización configurada");
  }
  return data[0].id;
}

function reservableDaysFrom(payload: WorkerOrdersPayload) {
  return payload.menuWeek.days.filter(
    (day) =>
      !day.disabled &&
      Date.now() <= new Date(day.preorderDeadline).getTime() &&
      day.options.some((option) => option.visible && option.availableForWorkers),
  );
}

async function planOptionAssignments(
  days: WorkerOrdersPayload["menuWeek"]["days"],
  requestedWorkers: number,
) {
  const { data: existingOrders, error } = await admin
    .from("orders")
    .select("menu_option_id, quantity")
    .in("service_day_id", days.map((day) => day.id))
    .eq("status", "confirmed");
  if (error) {
    throw new Error(`No se pudieron calcular los cupos disponibles: ${error.message}`);
  }

  const occupiedByOption = new Map<string, number>();
  for (const order of existingOrders ?? []) {
    occupiedByOption.set(
      order.menu_option_id,
      (occupiedByOption.get(order.menu_option_id) ?? 0) + order.quantity,
    );
  }

  const assignments = new Map<string, string[]>();
  for (const day of days) {
    const assigned: string[] = [];
    const options = day.options.filter(
      (option) => option.visible && option.availableForWorkers,
    );
    for (const option of options) {
      const available = option.capacity === null
        ? requestedWorkers - assigned.length
        : Math.max(0, option.capacity - (occupiedByOption.get(option.id) ?? 0));
      assigned.push(
        ...Array.from(
          { length: Math.min(available, requestedWorkers - assigned.length) },
          () => option.id,
        ),
      );
      if (assigned.length === requestedWorkers) break;
    }
    if (assigned.length < requestedWorkers) {
      throw new Error(
        `El día ${day.serviceDate} admite ${assigned.length} bots adicionales, no ${requestedWorkers}`,
      );
    }
    assignments.set(day.id, assigned);
  }
  return assignments;
}

async function authenticateBot(
  bot: CreatedBot,
): Promise<AuthenticatedBotResult | FailureResult> {
  const startedAt = performance.now();
  let authRetries = 0;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: bot.email,
      password: sharedPassword,
    });
    if (data.session?.access_token) {
      return {
        ok: true,
        ...bot,
        token: data.session.access_token,
        authMs: performance.now() - startedAt,
        authRetries,
      };
    }

    const message = error?.message ?? "Sin sesión";
    const rateLimited = message.toLocaleLowerCase("es-CL").includes("rate limit");
    if (!rateLimited || attempt === 5) {
      return failureResult(bot.index, "auth", message, performance.now() - startedAt);
    }
    authRetries += 1;
    await delay(Math.max(authIntervalMs, 2_100) * (attempt + 1));
  }

  return failureResult(
    bot.index,
    "auth",
    "Se agotaron los reintentos",
    performance.now() - startedAt,
  );
}

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}) {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
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
      error?: { code?: string; message?: string };
    };
    return {
      ok: response.ok,
      data: payload.data,
      error: payload.error?.code ?? payload.error?.message ?? `HTTP_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      data: undefined,
      error: error instanceof Error ? error.message : "NETWORK_ERROR",
    };
  }
}

async function cleanup() {
  if (createdDinerIds.length) {
    const { error: orderError } = await admin
      .from("orders")
      .delete()
      .in("diner_id", createdDinerIds);
    if (orderError) throw new Error(`pedidos: ${orderError.message}`);
    const { error: dinerError } = await admin
      .from("diners")
      .delete()
      .in("id", createdDinerIds);
    if (dinerError) throw new Error(`comensales: ${dinerError.message}`);
  }
  if (createdAuthIds.length) {
    const { error: auditError } = await admin
      .from("audit_events")
      .delete()
      .in("actor_id", createdAuthIds);
    if (auditError) throw new Error(`auditoría: ${auditError.message}`);
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .in("id", createdAuthIds);
    if (profileError) throw new Error(`perfiles: ${profileError.message}`);
    const deletionResults = await mapLimit(createdAuthIds, 6, async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      return error?.message ?? null;
    });
    const authErrors = deletionResults.filter(Boolean);
    if (authErrors.length) throw new Error(`${authErrors.length} cuentas Auth no se eliminaron`);
  }
}

async function cleanupStaleLoadTestData() {
  const staleUsers = (await listAllAuthUsers()).filter(
    (user) =>
      user.email?.endsWith("@sn-colaciones.test") &&
      typeof user.user_metadata?.load_test_run === "string",
  );
  if (!staleUsers.length) return;

  const authIds = staleUsers.map((user) => user.id);
  const { data: diners, error: dinerReadError } = await admin
    .from("diners")
    .select("id")
    .in("auth_user_id", authIds);
  if (dinerReadError) throw new Error(`No se pudo revisar la limpieza anterior: ${dinerReadError.message}`);
  const dinerIds = (diners ?? []).map((diner) => diner.id);

  if (dinerIds.length) {
    const { error: orderError } = await admin.from("orders").delete().in("diner_id", dinerIds);
    if (orderError) throw new Error(`pedidos anteriores: ${orderError.message}`);
    const { error: dinerError } = await admin.from("diners").delete().in("id", dinerIds);
    if (dinerError) throw new Error(`comensales anteriores: ${dinerError.message}`);
  }
  const { error: auditError } = await admin
    .from("audit_events")
    .delete()
    .in("actor_id", authIds);
  if (auditError) throw new Error(`auditoría anterior: ${auditError.message}`);
  const { error: profileError } = await admin.from("profiles").delete().in("id", authIds);
  if (profileError) throw new Error(`perfiles anteriores: ${profileError.message}`);
  const deletionResults = await mapLimit(authIds, 6, async (userId) => {
    const { error } = await admin.auth.admin.deleteUser(userId);
    return error?.message ?? null;
  });
  const errors = deletionResults.filter(Boolean);
  if (errors.length) throw new Error(`${errors.length} cuentas anteriores no se eliminaron`);
  console.log(`Limpieza preventiva: ${authIds.length} bots antiguos eliminados.`);
}

async function listAllAuthUsers() {
  const users: Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }> = [];
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`No se pudieron consultar cuentas temporales: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Valor fuera de rango: debe ser un entero entre ${min} y ${max}`);
  }
  return parsed;
}

function percentile<T extends Record<K, number>, K extends string>(
  values: T[],
  key: K,
  requestedPercentile: number,
) {
  if (!values.length) return 0;
  const sorted = values.map((value) => value[key]).toSorted((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((requestedPercentile / 100) * sorted.length) - 1,
  );
  return Math.round(sorted[index]);
}

function maximum<T extends Record<K, number>, K extends string>(values: T[], key: K) {
  return values.length ? Math.round(Math.max(...values.map((value) => value[key]))) : 0;
}

function failureResult(
  index: number,
  stage: string,
  error: string,
  totalMs: number,
): FailureResult {
  return { ok: false as const, index, stage, error, totalMs };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type CreatedBot = {
  id: string;
  email: string;
  fullName: string;
  index: number;
};

type AuthenticatedBotResult = CreatedBot & {
  ok: true;
  token: string;
  authMs: number;
  authRetries: number;
};

type FailureResult = {
  ok: false;
  index: number;
  stage: string;
  error: string;
  totalMs: number;
};

type WorkerOrdersPayload = {
  menuWeek: {
    days: Array<{
      id: string;
      serviceDate: string;
      disabled: boolean;
      preorderDeadline: string;
      options: Array<{
        id: string;
        capacity: number | null;
        visible: boolean;
        availableForWorkers: boolean;
      }>;
    }>;
  };
  orders: Array<{
    serviceDayId: string;
    status: "confirmed" | "cancelled";
  }>;
};
