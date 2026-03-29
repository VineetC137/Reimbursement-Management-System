import { Router } from "express";
import { ZodError } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { assignManagerSchema, createUserSchema, updateUserRoleSchema } from "./user.schema.js";
import { assignCompanyManager, createCompanyUser, listCompanyUsers, updateCompanyUserRole } from "./user.service.js";

const usersRouter = Router();

function toValidationDetails(error: ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const path = issue.path.join(".") || "form";
    accumulator[path] = issue.message;
    return accumulator;
  }, {});
}

function getRouteParam(value: string | string[] | undefined, name: string): string {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (!normalizedValue) {
    throw new AppError(400, "INVALID_ROUTE_PARAM", `${name} is required`);
  }

  return normalizedValue;
}

usersRouter.use(requireAuth);
usersRouter.use(requireRole("ADMIN"));

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const users = await listCompanyUsers(req.auth.companyId);

    res.json({
      success: true,
      data: users
    });
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = createUserSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const user = await createCompanyUser(req.auth.companyId, req.auth.userId, parsedBody.data);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user
    });
  })
);

usersRouter.patch(
  "/:userId/role",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = updateUserRoleSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const userId = getRouteParam(req.params.userId, "userId");
    const user = await updateCompanyUserRole(req.auth.companyId, req.auth.userId, userId, parsedBody.data);

    res.json({
      success: true,
      message: "Role updated successfully",
      data: user
    });
  })
);

usersRouter.post(
  "/:userId/manager",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = assignManagerSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const userId = getRouteParam(req.params.userId, "userId");
    const user = await assignCompanyManager(req.auth.companyId, req.auth.userId, userId, parsedBody.data);

    res.json({
      success: true,
      message: "Manager assigned successfully",
      data: user
    });
  })
);

export { usersRouter };
