import { describe, expect, it } from "vitest";
import { renderNotificationEmail } from "../src/services/email-notification.service.js";

describe("plantilla de notificaciones por correo", () => {
  it("escapa contenido dinámico, genera texto y enlaza al sistema", async () => {
    const email = await renderNotificationEmail({
      title: "Solicitud <pendiente>",
      message: 'María & "visita"',
      appUrl: "https://colaciones.example.cl",
    });

    expect(email.html).toContain("Solicitud &lt;pendiente&gt;");
    expect(email.html).toContain("María &amp;");
    expect(email.html).not.toContain("<pendiente>");
    expect(email.html).toContain('href="https://colaciones.example.cl"');
    expect(email.html).toContain("SN Colaciones nunca solicitará tu contraseña");
    expect(email.text).toContain("SOLICITUD <PENDIENTE>");
    expect(email.text).toContain("Revisar en SN Colaciones https://colaciones.example.cl");
  });
});
