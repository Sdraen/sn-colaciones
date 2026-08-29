import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authenticate } from "../middleware/authenticate.js";
import { authRouter } from "./auth.routes.js";
import { menuRouter } from "./menu.routes.js";
import { orderRouter } from "./order.routes.js";
import { providerRouter } from "./provider.routes.js";
import { companyRouter } from "./company.routes.js";
import { notificationRouter } from "./notification.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/v1", authenticate);
apiRouter.use("/v1/auth", authRouter);
apiRouter.use("/v1/menus", menuRouter);
apiRouter.use("/v1/orders", orderRouter);
apiRouter.use("/v1/notifications", notificationRouter);
apiRouter.use("/v1/company", companyRouter);
apiRouter.use("/v1/provider", providerRouter);
