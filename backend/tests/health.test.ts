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
});
