import { dispatchPendingEmailNotifications } from "../src/services/email-notification.service.js";

const apply = process.argv.includes("--apply");
const result = await dispatchPendingEmailNotifications({ dryRun: !apply });

console.log(
  apply
    ? `Cola: ${result.queued}; enviados: ${result.sent}; omitidos: ${result.skipped}; errores: ${result.failed}.`
    : `Simulación: ${result.queued} correo(s) pendiente(s); ${result.skipped} listo(s) para enviar; ${result.failed} sin destinatario.`,
);

if (apply && result.failed > 0) process.exitCode = 1;
