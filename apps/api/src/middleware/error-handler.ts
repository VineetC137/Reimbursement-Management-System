import { NextFunction, Request, Response } from "express";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = error instanceof Error ? error.message : "Unexpected server error";

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message
    }
  });
}
