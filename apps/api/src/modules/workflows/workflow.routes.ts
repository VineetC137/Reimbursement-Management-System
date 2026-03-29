import { Router } from "express";
import { ZodError } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { updateWorkflowSchema } from "./workflow.schema.js";
import { getWorkflowSettings, updateWorkflowSettings } from "./workflow.service.js";

const workflowRouter = Router();

function toValidationDetails(error: ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const path = issue.path.join(".") || "form";
    accumulator[path] = issue.message;
    return accumulator;
  }, {});
}

workflowRouter.use(requireAuth);
workflowRouter.use(requireRole("ADMIN"));

workflowRouter.get(
  "/default",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const workflow = await getWorkflowSettings(req.auth.companyId);

    res.json({
      success: true,
      data: workflow
    });
  })
);

workflowRouter.put(
  "/default",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = updateWorkflowSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const workflow = await updateWorkflowSettings(req.auth.companyId, req.auth.userId, parsedBody.data);

    res.json({
      success: true,
      message: "Workflow settings updated successfully",
      data: workflow
    });
  })
);

export { workflowRouter };
