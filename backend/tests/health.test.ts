import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  it("responde con el estado del backend", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "sn-colaciones-backend",
    });
    expect(new Date(response.body.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("normaliza rutas inexistentes", async () => {
    const response = await request(createApp()).get("/api/no-existe");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("protege las rutas versionadas", async () => {
    const response = await request(createApp()).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("rechaza cuerpos HTTP comprimidos antes de procesarlos", async () => {
    const response = await request(createApp())
      .post("/api/v1/orders/me")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send(Buffer.from("{}"));

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_CONTENT_ENCODING");
    expect(response.body.error.requestId).toBeTruthy();
  });
});
