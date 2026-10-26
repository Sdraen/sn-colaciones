import cors from "cors";
import express, { type RequestHandler } from "express";
import helmetModule from "helmet";
import { getRuntimeEnv } from "./config/env.js";
import { AppError } from "./errors/app-error.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { edgeRateLimit } from "./middleware/rate-limit.js";
import { apiRouter } from "./routes/index.js";

type AppOptions = {
  corsOrigins?: string[];
  trustProxyHops?: number;
};

const createHelmet = helmetModule as unknown as () => RequestHandler;

const rejectCompressedRequestBodies: RequestHandler = (request, _response, next) => {
  const contentEncoding = request.header("content-encoding")?.trim().toLowerCase();

  if (!contentEncoding || contentEncoding === "identity") {
    next();
    return;
  }

  next(
    new AppError(
      "El contenido comprimido no esta permitido",
      415,
      "UNSUPPORTED_CONTENT_ENCODING",
    ),
  );
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const corsOrigins = options.corsOrigins ?? ["http://localhost:3000"];

  app.disable("x-powered-by");
  if ((options.trustProxyHops ?? 0) > 0) {
    app.set("trust proxy", options.trustProxyHops);
  }
  app.use(requestContext);
  app.use(createHelmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(rejectCompressedRequestBodies);
  app.use(express.json({ limit: "1mb", inflate: false }));

  app.get("/", (_request, response) => {
    response.status(200).json({ service: "sn-colaciones-backend" });
  });
  app.use("/api", edgeRateLimit, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const runtimeEnv = getRuntimeEnv();

const app = createApp({
  corsOrigins: runtimeEnv.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  trustProxyHops: runtimeEnv.TRUST_PROXY_HOPS,
});

export default app;
