import { describe, expect, it } from "vitest";
import { renderNotificationEmail } from "../src/services/email-notification.service.js";

describe("plantilla de notificaciones por correo", () => {
  it("escapa contenido dinámico y enlaza al sistema", () => {
    const html = renderNotificationEmail({
      title: "Solicitud <pendiente>",
      message: 'María & "visita"',
      appUrl: "https://colaciones.example.cl",
    });

    expect(html).toContain("Solicitud &lt;pendiente&gt;");
    expect(html).toContain("María &amp; &quot;visita&quot;");
    expect(html).toContain('href="https://colaciones.example.cl"');
  });
});
