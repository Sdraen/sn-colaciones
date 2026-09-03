import { Router } from "express";
import { patchDeliveryEvent } from "../controllers/delivery.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { recordDeliveryEventRequestSchema } from "../schemas/delivery.schema.js";

export const deliveryRouter = Router();

deliveryRouter.use(requireRole("delivery"));
deliveryRouter.patch(
  "/service-days/:serviceDayId/events",
  validateRequest(recordDeliveryEventRequestSchema),
  patchDeliveryEvent,
);
