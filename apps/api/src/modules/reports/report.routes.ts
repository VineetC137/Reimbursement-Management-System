import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { exportReportAsCsv, type ReportExportType } from "./report-export.service.js";
import {
  getAgingReport,
  getDashboardReport,
  getPendingByApproverReport,
  getRejectionReport
} from "./report.service.js";

const reportRouter = Router();

function normalizeExportType(value: unknown): ReportExportType {
  if (
    value === "dashboard" ||
    value === "pending-by-approver" ||
    value === "rejections" ||
    value === "aging"
  ) {
    return value;
  }

  throw new AppError(400, "INVALID_EXPORT_TYPE", "Choose dashboard, pending-by-approver, rejections, or aging for export.");
}

reportRouter.use(requireAuth);
reportRouter.use(requireRole("ADMIN", "MANAGER"));

reportRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const report = await getDashboardReport(req.auth);

    res.json({
      success: true,
      data: report
    });
  })
);

reportRouter.get(
  "/pending-by-approver",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const report = await getPendingByApproverReport(req.auth);

    res.json({
      success: true,
      data: report
    });
  })
);

reportRouter.get(
  "/rejections",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const report = await getRejectionReport(req.auth);

    res.json({
      success: true,
      data: report
    });
  })
);

reportRouter.get(
  "/aging",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const report = await getAgingReport(req.auth);

    res.json({
      success: true,
      data: report
    });
  })
);

reportRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const type = normalizeExportType(req.query.type);
    const exportedReport = await exportReportAsCsv(req.auth, type);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${exportedReport.fileName}\"`);
    res.send(exportedReport.content);
  })
);

export { reportRouter };
