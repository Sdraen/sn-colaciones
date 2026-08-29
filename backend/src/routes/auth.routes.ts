import { Router } from "express";
import { getCurrentUser } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.get("/me", getCurrentUser);
