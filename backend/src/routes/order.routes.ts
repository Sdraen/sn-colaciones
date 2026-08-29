import { Router } from "express";
import {
  deleteMyOrder,
  getMyOrders,
  putMyOrder,
} from "../controllers/order.controller.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  cancelOrderRequestSchema,
  listMyOrdersRequestSchema,
  saveRegularOrderRequestSchema,
} from "../schemas/order.schema.js";

export const orderRouter = Router();

orderRouter.use(requireRole("worker"));
orderRouter.get("/me", validateRequest(listMyOrdersRequestSchema), getMyOrders);
orderRouter.put("/me", validateRequest(saveRegularOrderRequestSchema), putMyOrder);
orderRouter.delete(
  "/me/:orderId",
  validateRequest(cancelOrderRequestSchema),
  deleteMyOrder,
);
