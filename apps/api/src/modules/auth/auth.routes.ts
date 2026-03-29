import { Router } from "express";
import { ZodError } from "zod";

import { requireAuth } from "../../middleware/require-auth.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { getCurrentSession, loginUser, signupAdmin } from "./auth.service.js";
import { loginSchema, signupSchema } from "./auth.schema.js";

const authRouter = Router();

function toValidationDetails(error: ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const path = issue.path.join(".") || "form";
    accumulator[path] = issue.message;
    return accumulator;
  }, {});
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const parsedBody = signupSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const session = await signupAdmin(parsedBody.data);

    res.status(201).json({
      success: true,
      message: "Company and admin account created successfully",
      data: session
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsedBody = loginSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const session = await loginUser(parsedBody.data);

    res.json({
      success: true,
      message: "Login successful",
      data: session
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const session = await getCurrentSession(req.auth.userId);

    res.json({
      success: true,
      data: session
    });
  })
);

export { authRouter };
