import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestContext } from "../src/middleware/request-context.js";
import { validateRequest } from "../src/middleware/validate-request.js";
import { saveRegularOrderRequestSchema } from "../src/schemas/order.schema.js";
import { resolveExceptionRequestSchema } from "../src/schemas/provider.schema.js";

describe("validación de contratos HTTP", () => {
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.put(
    "/orders",
    validateRequest(saveRegularOrderRequestSchema),
    (httpRequest, response) => response.json({ data: httpRequest.validated }),
  );
  app.patch(
    "/exceptions/:exceptionId",
    validateRequest(resolveExceptionRequestSchema),
    (httpRequest, response) => response.json({ data: httpRequest.validated }),
  );
  app.use(errorHandler);

  it("normaliza y acepta un pedido que elige té", async () => {
    const response = await request(app).put("/orders").send({
      serviceDayId: "00000000-0000-4000-8000-000000000001",
      menuOptionId: "00000000-0000-4000-8000-000000000002",
      side: "ensalada",
      tea: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.body).toMatchObject({ bread: false, tea: true });
  });

  it("responde 400 con errores por campo", async () => {
    const response = await request(app).put("/orders").send({
      serviceDayId: "no-es-uuid",
      menuOptionId: "tampoco",
      side: "papas",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields.body).toBeDefined();
  });

  it("exige un motivo claro al rechazar una solicitud extraordinaria", async () => {
    const response = await request(app)
      .patch("/exceptions/00000000-0000-4000-8000-000000000003")
      .send({ status: "rejected" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("permite aprobar una solicitud sin motivo de rechazo", async () => {
    const response = await request(app)
      .patch("/exceptions/00000000-0000-4000-8000-000000000003")
      .send({ status: "approved" });

    expect(response.status).toBe(200);
    expect(response.body.data.body.status).toBe("approved");
  });
});
