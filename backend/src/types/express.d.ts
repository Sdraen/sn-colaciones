import type { RequestAuth } from "../models/auth.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: RequestAuth;
      validated?: unknown;
    }
  }
}

export {};
