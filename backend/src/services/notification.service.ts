import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database } from "../types/database.js";

type UserDatabaseClient = SupabaseClient<Database>;
type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export async function listNotifications(
  supabase: UserDatabaseClient,
  input: { unreadOnly: boolean; limit: number },
) {
  let query = supabase
    .from("notifications")
    .select(
      "id, channel, event_type, title, body, related_entity_type, related_entity_id, delivered_at, read_at, created_at",
    )
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error) throwSupabaseError(error, "No fue posible consultar las notificaciones");

  return (data ?? []).map(serializeNotification);
}

export async function markNotificationRead(
  supabase: UserDatabaseClient,
  notificationId: string,
) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select(
      "id, channel, event_type, title, body, related_entity_type, related_entity_id, delivered_at, read_at, created_at",
    )
    .maybeSingle();
  if (error) throwSupabaseError(error, "No fue posible marcar la notificación como leída");
  if (!data) throw new AppError("No se encontró la notificación", 404, "NOTIFICATION_NOT_FOUND");

  return serializeNotification(data);
}

type NotificationSummary = Pick<
  Notification,
  | "id"
  | "channel"
  | "event_type"
  | "title"
  | "body"
  | "related_entity_type"
  | "related_entity_id"
  | "delivered_at"
  | "read_at"
  | "created_at"
>;

function serializeNotification(notification: NotificationSummary) {
  return {
    id: notification.id,
    channel: notification.channel,
    eventType: notification.event_type,
    title: notification.title,
    message: notification.body,
    relatedEntityType: notification.related_entity_type,
    relatedEntityId: notification.related_entity_id,
    deliveredAt: notification.delivered_at,
    readAt: notification.read_at,
    createdAt: notification.created_at,
  };
}
