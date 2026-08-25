import type { HealthResponse } from "../schemas/health.schema.js";

export function getHealthStatus(): HealthResponse {
  return {
    status: "ok",
    service: "sn-colaciones-backend",
    timestamp: new Date().toISOString(),
  };
}
