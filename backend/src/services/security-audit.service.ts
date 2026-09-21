import type { SupabaseClient } from "@supabase/supabase-js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, Json } from "../types/database.js";

export async function recordSecurityAuditEvent(
  admin: SupabaseClient<Database>,
  event: {
    organizationId: string;
    actorId: string;
    entityType: string;
    entityId?: string | null;
    action: string;
    metadata?: Json;
  },
) {
  const { error } = await admin.from("audit_events").insert({
    organization_id: event.organizationId,
    actor_id: event.actorId,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    action: event.action,
    metadata: event.metadata ?? {},
  });
  if (error) throwSupabaseError(error, "No fue posible registrar la auditoria de seguridad");
}
