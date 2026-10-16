import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const templatesDirectory = fileURLToPath(
  new URL("../../supabase/templates/", import.meta.url),
);

describe("plantillas de creación de contraseña", () => {
  it.each([
    ["invite.html", "invite"],
    ["recovery.html", "recovery"],
  ])("valida %s mediante token hash y exige MFA antes del formulario", (fileName, type) => {
    const template = readFileSync(`${templatesDirectory}${fileName}`, "utf8");

    expect(template).toContain("{{ .TokenHash }}");
    expect(template).toContain(`type=${type}`);
    expect(template).toContain(
      "next=%2Fauth%2Fcontinuar%3Fnext%3D%252Fcrear-contrasena",
    );
    expect(template).not.toContain("{{ .ConfirmationURL }}");
  });
});
