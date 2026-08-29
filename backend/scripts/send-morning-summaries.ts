import { dispatchPendingEmailNotifications } from "../src/services/email-notification.service.js";
import { queueMorningSummaries } from "../src/services/morning-summary.service.js";

const apply = process.argv.includes("--apply");
const queued = await queueMorningSummaries({ dryRun: !apply });

if (!apply) {
  console.log(`Simulación: se crearían ${queued.candidates} avisos de resumen.`);
} else {
  const delivered = await dispatchPendingEmailNotifications({ dryRun: false });
  console.log(
    `Avisos creados: ${queued.created}; correos enviados: ${delivered.sent}; errores: ${delivered.failed}.`,
  );
  if (delivered.failed > 0) process.exitCode = 1;
}
