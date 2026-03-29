import { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/app-error.js";
import { verifyAccessToken } from "../utils/tokens.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "AUTH_REQUIRED", "Authorization token is required"));
    return;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
