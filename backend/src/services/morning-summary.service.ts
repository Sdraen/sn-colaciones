import { createAdminSupabaseClient } from "../lib/supabase.js";
import type { OrderKind } from "../types/database.js";

interface QueueMorningSummariesInput {
  dryRun?: boolean;
  now?: Date;
}

interface SummaryCounts {
  regular: number;
  training: number;
  extra: number;
  exceptional: number;
  total: number;
}

export async function queueMorningSummaries(
  input: QueueMorningSummariesInput = {},
) {
  const dryRun = input.dryRun ?? true;
  const now = input.now ?? new Date();
  const supabase = createAdminSupabaseClient();
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("id, timezone");
  if (organizationError) throw new Error(`No fue posible consultar organizaciones: ${organizationError.message}`);

  let candidates = 0;
  let created = 0;

  for (const organization of organizations ?? []) {
    const serviceDate = dateInTimeZone(now, organization.timezone);
    const { data: weeks, error: weekError } = await supabase
      .from("menu_weeks")
      .select("id")
      .eq("organization_id", organization.id);
    if (weekError) throw new Error(`No fue posible consultar semanas: ${weekError.message}`);
    const weekIds = (weeks ?? []).map((week) => week.id);
    if (weekIds.length === 0) continue;

    const { data: serviceDay, error: dayError } = await supabase
      .from("service_days")
      .select("id")
      .in("menu_week_id", weekIds)
      .eq("service_date", serviceDate)
      .eq("disabled", false)
      .maybeSingle();
    if (dayError) throw new Error(`No fue posible consultar el día de servicio: ${dayError.message}`);
    if (!serviceDay) continue;

    const [{ data: orders, error: orderError }, { data: profiles, error: profileError }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("kind, quantity")
          .eq("service_day_id", serviceDay.id)
          .eq("status", "confirmed"),
        supabase
          .from("profiles")
          .select("id")
          .eq("organization_id", organization.id)
          .in("role", ["company_admin", "provider_admin"])
          .eq("active", true),
      ]);
    if (orderError) throw new Error(`No fue posible contar los pedidos: ${orderError.message}`);
    if (profileError) throw new Error(`No fue posible consultar administradoras: ${profileError.message}`);

    const counts = summarizeOrders(orders ?? []);
    const title = `Resumen de colaciones del ${serviceDate}`;
    const body = buildMorningSummaryMessage(counts);

    for (const profile of profiles ?? []) {
      for (const channel of ["in_app", "email"] as const) {
        const { count, error: existingError } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_profile_id", profile.id)
          .eq("channel", channel)
          .eq("event_type", "morning_summary")
          .eq("related_entity_id", serviceDay.id);
        if (existingError) throw new Error(`No fue posible verificar el resumen: ${existingError.message}`);
        if ((count ?? 0) > 0) continue;

        candidates += 1;
        if (dryRun) continue;
        const { error: insertError } = await supabase.from("notifications").insert({
          organization_id: organization.id,
          recipient_profile_id: profile.id,
          channel,
          event_type: "morning_summary",
          title,
          body,
          related_entity_type: "service_day",
          related_entity_id: serviceDay.id,
          delivered_at: channel === "in_app" ? now.toISOString() : null,
        });
        if (insertError) throw new Error(`No fue posible crear el resumen: ${insertError.message}`);
        created += 1;
      }
    }
  }

  return { candidates, created };
}

export function summarizeOrders(
  orders: Array<{ kind: OrderKind; quantity: number }>,
): SummaryCounts {
  const counts: SummaryCounts = {
    regular: 0,
    training: 0,
    extra: 0,
    exceptional: 0,
    total: 0,
  };
  for (const order of orders) {
    counts[order.kind] += order.quantity;
    counts.total += order.quantity;
  }
  return counts;
}

export function buildMorningSummaryMessage(counts: SummaryCounts) {
  return `${counts.total} colaciones confirmadas: ${counts.regular} trabajadores, ${counts.training} capacitaciones, ${counts.extra} ingresos de 08:00 a 11:00 y ${counts.exceptional} extraordinarias aprobadas.`;
}

function dateInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
