import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestContext } from "../src/middleware/request-context.js";
import { accountManagementRateLimit } from "../src/middleware/rate-limit.js";
import type { RequestAuth } from "../src/models/auth.js";

describe("application rate limits", () => {
  it("limits repeated access-management operations for the same user", async () => {
    const app = express();
    app.use(requestContext);
    app.use((httpRequest, _response, next) => {
      httpRequest.auth = {
        assuranceLevel: "aal2",
        user: { id: "00000000-0000-4000-8000-000000000001" },
      } as RequestAuth;
      next();
    });
    app.post("/access", accountManagementRateLimit, (_request, response) => {
      response.status(204).send();
    });
    app.use(errorHandler);

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await request(app).post("/access");
      expect(response.status).toBe(204);
    }

    const blocked = await request(app).post("/access");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("ACCOUNT_RATE_LIMIT_EXCEEDED");
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
  });
});
