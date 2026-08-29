import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { apiRouter } from "./routes/index.js";

type AppOptions = {
  corsOrigins?: string[];
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const corsOrigins = options.corsOrigins ?? ["http://localhost:3000"];

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_request, response) => {
    response.status(200).json({ service: "sn-colaciones-backend" });
  });
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
