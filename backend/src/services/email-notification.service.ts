import { render } from "react-email";
import { Resend } from "resend";
import { getEmailEnv } from "../config/env.js";
import { createAdminSupabaseClient } from "../lib/supabase.js";
import { NotificationEmail } from "../templates/emails/notification-email.js";

interface DispatchEmailNotificationsInput {
  dryRun?: boolean;
  limit?: number;
}

interface DispatchResult {
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function dispatchPendingEmailNotifications(
  input: DispatchEmailNotificationsInput = {},
): Promise<DispatchResult> {
  const dryRun = input.dryRun ?? true;
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, recipient_profile_id, title, body, event_type, related_entity_id",
    )
    .eq("channel", "email")
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`No fue posible consultar la cola de correo: ${error.message}`);

  const result: DispatchResult = {
    queued: data?.length ?? 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };
  const emailConfig = dryRun ? null : getEmailEnv();
  const resend = emailConfig ? new Resend(emailConfig.RESEND_API_KEY) : null;

  for (const notification of data ?? []) {
    const { data: authData, error: authError } =
      await supabase.auth.admin.getUserById(notification.recipient_profile_id);
    const recipientEmail = authData.user?.email;

    if (authError || !recipientEmail) {
      result.failed += 1;
      if (!dryRun) {
        await saveDeliveryError(
          notification.id,
          authError?.message ?? "El perfil no tiene un correo asociado",
        );
      }
      continue;
    }

    if (dryRun || !resend || !emailConfig) {
      result.skipped += 1;
      continue;
    }

    const emailContent = await renderNotificationEmail({
      title: notification.title,
      message: notification.body,
      appUrl: emailConfig.APP_URL,
    });
    const { error: sendError } = await resend.emails.send(
      {
        from: emailConfig.EMAIL_FROM,
        to: recipientEmail,
        subject: notification.title,
        text: emailContent.text,
        html: emailContent.html,
      },
      { idempotencyKey: `notification-${notification.id}` },
    );

    if (sendError) {
      result.failed += 1;
      await saveDeliveryError(notification.id, sendError.message);
      continue;
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ delivered_at: new Date().toISOString(), error_message: null })
      .eq("id", notification.id)
      .is("delivered_at", null);
    if (updateError) throw new Error(`El correo fue enviado, pero no se pudo registrar: ${updateError.message}`);
    result.sent += 1;
  }

  return result;

  async function saveDeliveryError(notificationId: string, message: string) {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ error_message: message.slice(0, 500) })
      .eq("id", notificationId);
    if (updateError) throw new Error(`No fue posible registrar el error de correo: ${updateError.message}`);
  }
}

export async function renderNotificationEmail(input: {
  title: string;
  message: string;
  appUrl: string;
}) {
  const template = NotificationEmail(input);
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ]);
  return { html, text };
}
