import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticate, readBearerToken } from "../src/middleware/authenticate.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestContext } from "../src/middleware/request-context.js";
import { requireRole } from "../src/middleware/require-role.js";
import { requireAdministrativeMfa } from "../src/middleware/require-administrative-mfa.js";
import type { RequestAuth } from "../src/models/auth.js";

function fakeAuth(
  role: RequestAuth["profile"]["role"],
  assuranceLevel: RequestAuth["assuranceLevel"] = "aal2",
): RequestAuth {
  return {
    accessToken: "valid-token",
    assuranceLevel,
    user: { id: "00000000-0000-4000-8000-000000000001" },
    profile: {
      id: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      fullName: "Usuario prueba",
      role,
    },
    supabase: {},
  } as unknown as RequestAuth;
}

describe("autenticación y autorización HTTP", () => {
  it("extrae únicamente tokens Bearer válidos", () => {
    expect(readBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(readBearerToken("bearer token-prueba")).toBe("token-prueba");
    expect(readBearerToken("Basic credenciales")).toBeNull();
    expect(readBearerToken()).toBeNull();
  });

  it("rechaza solicitudes sin sesión y entrega un request id", async () => {
    const verifier = vi.fn();
    const app = express();
    app.use(requestContext);
    app.get("/private", createAuthenticate(verifier), (_request, response) => {
      response.json({ ok: true });
    });
    app.use(errorHandler);

    const response = await request(app).get("/private");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(verifier).not.toHaveBeenCalled();
  });

  it("propaga el perfil verificado y aplica el rol requerido", async () => {
    const verifier = vi.fn().mockResolvedValue(fakeAuth("provider_admin"));
    const app = express();
    app.use(requestContext);
    app.get(
      "/provider",
      createAuthenticate(verifier),
      requireRole("provider_admin"),
      (httpRequest, response) => {
        response.json({ role: httpRequest.auth?.profile.role });
      },
    );
    app.use(errorHandler);

    const response = await request(app)
      .get("/provider")
      .set("authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ role: "provider_admin" });
    expect(verifier).toHaveBeenCalledWith("valid-token");
  });

  it("impide que otro rol use rutas de la proveedora", async () => {
    const app = express();
    app.use(requestContext);
    app.get(
      "/provider",
      createAuthenticate(async () => fakeAuth("worker")),
      requireRole("provider_admin"),
      (_request, response) => response.json({ ok: true }),
    );
    app.use(errorHandler);

    const response = await request(app)
      .get("/provider")
      .set("authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("exige MFA a los roles administrativos", async () => {
    const app = express();
    app.use(requestContext);
    app.get(
      "/admin",
      createAuthenticate(async () => fakeAuth("company_admin", "aal1")),
      requireAdministrativeMfa,
      (_request, response) => response.json({ ok: true }),
    );
    app.use(errorHandler);

    const response = await request(app)
      .get("/admin")
      .set("authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MFA_REQUIRED");
  });

  it("permite MFA aal2 y no obliga a trabajadores", async () => {
    for (const auth of [
      fakeAuth("provider_admin", "aal2"),
      fakeAuth("worker", "aal1"),
    ]) {
      const app = express();
      app.use(requestContext);
      app.get(
        "/private",
        createAuthenticate(async () => auth),
        requireAdministrativeMfa,
        (_request, response) => response.json({ ok: true }),
      );
      app.use(errorHandler);

      const response = await request(app)
        .get("/private")
        .set("authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
    }
  });
});
