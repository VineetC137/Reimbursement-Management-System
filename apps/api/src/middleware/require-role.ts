import { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/app-error.js";

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, "AUTH_REQUIRED", "Authorization token is required"));
      return;
    }

    const hasAllowedRole = req.auth.roles.some((role) => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      next(new AppError(403, "INSUFFICIENT_ROLE", "You do not have access to this resource"));
      return;
    }

    next();
  };
}
