import { Router } from "express";
import { ZodError } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { receiptUploadMiddleware } from "../../middleware/upload-receipt.js";
import {
  actOnExpense,
  applyReceiptOcrToExpense,
  createExpense,
  getExpenseDetail,
  listApprovalQueue,
  listExpenseCategories,
  listExpenses,
  overrideExpense,
  submitExpense,
  uploadExpenseReceipt,
  updateExpense
} from "./expense.service.js";
import { approvalActionSchema, createExpenseSchema, overrideExpenseSchema, updateExpenseSchema } from "./expense.schema.js";

const expenseRouter = Router();

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

expenseRouter.use(requireAuth);

expenseRouter.get(
  "/categories",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const categories = await listExpenseCategories(req.auth.companyId);

    res.json({
      success: true,
      data: categories
    });
  })
);

expenseRouter.get(
  "/queue",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const queue = await listApprovalQueue(req.auth);

    res.json({
      success: true,
      data: queue
    });
  })
);

expenseRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const expenses = await listExpenses(req.auth);

    res.json({
      success: true,
      data: expenses
    });
  })
);

expenseRouter.get(
  "/:expenseId",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const expense = await getExpenseDetail(req.auth, expenseId);

    res.json({
      success: true,
      data: expense
    });
  })
);

expenseRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = createExpenseSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const expense = await createExpense(req.auth.companyId, req.auth.userId, parsedBody.data);

    res.status(201).json({
      success: true,
      message: "Expense draft created successfully",
      data: expense
    });
  })
);

expenseRouter.patch(
  "/:expenseId",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = updateExpenseSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const expense = await updateExpense(req.auth.companyId, req.auth.userId, expenseId, parsedBody.data);

    res.json({
      success: true,
      message: "Expense draft updated successfully",
      data: expense
    });
  })
);

expenseRouter.post(
  "/:expenseId/receipt",
  receiptUploadMiddleware.single("receipt"),
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    if (!req.file) {
      throw new AppError(400, "RECEIPT_REQUIRED", "Upload a receipt file before continuing");
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const result = await uploadExpenseReceipt(req.auth, expenseId, req.file);

    res.status(201).json({
      success: true,
      message: "Receipt uploaded and OCR processed successfully",
      data: result
    });
  })
);

expenseRouter.post(
  "/:expenseId/receipt/apply-ocr",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const expense = await applyReceiptOcrToExpense(req.auth, expenseId);

    res.json({
      success: true,
      message: "OCR values applied to the expense draft",
      data: expense
    });
  })
);

expenseRouter.post(
  "/:expenseId/submit",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const expense = await submitExpense(req.auth.companyId, req.auth.userId, expenseId);

    res.json({
      success: true,
      message: "Expense submitted successfully",
      data: expense
    });
  })
);

expenseRouter.post(
  "/:expenseId/action",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = approvalActionSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const expense = await actOnExpense(req.auth, expenseId, parsedBody.data);

    res.json({
      success: true,
      message: `Expense ${parsedBody.data.action.toLowerCase()}d successfully`,
      data: expense
    });
  })
);

expenseRouter.post(
  "/:expenseId/override",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const parsedBody = overrideExpenseSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", toValidationDetails(parsedBody.error));
    }

    const expenseId = getRouteParam(req.params.expenseId, "expenseId");
    const expense = await overrideExpense(req.auth, expenseId, parsedBody.data);

    res.json({
      success: true,
      message: `Expense ${parsedBody.data.action.toLowerCase()}d by admin override`,
      data: expense
    });
  })
);

export { expenseRouter };
