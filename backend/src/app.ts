import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { edgeRateLimit } from "./middleware/rate-limit.js";
import { apiRouter } from "./routes/index.js";

type AppOptions = {
  corsOrigins?: string[];
  trustProxyHops?: number;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const corsOrigins = options.corsOrigins ?? ["http://localhost:3000"];

  app.disable("x-powered-by");
  if ((options.trustProxyHops ?? 0) > 0) {
    app.set("trust proxy", options.trustProxyHops);
  }
  app.use(requestContext);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_request, response) => {
    response.status(200).json({ service: "sn-colaciones-backend" });
  });
  app.use("/api", edgeRateLimit, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
