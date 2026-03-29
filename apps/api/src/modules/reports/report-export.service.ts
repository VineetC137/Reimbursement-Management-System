import type { AuthContext } from "../../types/auth.js";
import {
  getAgingReport,
  getDashboardReport,
  getPendingByApproverReport,
  getRejectionReport
} from "./report.service.js";

export type ReportExportType = "dashboard" | "pending-by-approver" | "rejections" | "aging";

function escapeCsvCell(value: string | number | null): string {
  const normalizedValue = value === null ? "" : String(value);

  if (!/[",\n]/.test(normalizedValue)) {
    return normalizedValue;
  }

  return `"${normalizedValue.replace(/"/g, "\"\"")}"`;
}

export function buildCsvContent(rows: Array<Record<string, string | number | null>>): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header] ?? "")).join(","))
  ];

  return `${lines.join("\n")}\n`;
}

export async function exportReportAsCsv(auth: AuthContext, type: ReportExportType): Promise<{ fileName: string; content: string }> {
  switch (type) {
    case "dashboard": {
      const report = await getDashboardReport(auth);

      return {
        fileName: "dashboard-report.csv",
        content: buildCsvContent([
          {
            totalExpenses: report.totalExpenses,
            draftExpenses: report.draftExpenses,
            inReviewExpenses: report.inReviewExpenses,
            approvedExpenses: report.approvedExpenses,
            rejectedExpenses: report.rejectedExpenses,
            approvedAmountCompanyCurrency: report.approvedAmountCompanyCurrency,
            inReviewAmountCompanyCurrency: report.inReviewAmountCompanyCurrency
          }
        ])
      };
    }
    case "pending-by-approver": {
      const report = await getPendingByApproverReport(auth);

      return {
        fileName: "pending-by-approver.csv",
        content: buildCsvContent(
          report.map((item) => ({
            approverName: item.approverName,
            approverEmail: item.approverEmail,
            pendingCount: item.pendingCount
          }))
        )
      };
    }
    case "rejections": {
      const report = await getRejectionReport(auth);

      return {
        fileName: "rejections-report.csv",
        content: buildCsvContent(
          report.map((item) => ({
            employeeName: item.employeeName,
            categoryName: item.categoryName,
            amountCompanyCurrency: item.amountCompanyCurrency,
            companyCurrency: item.companyCurrency,
            rejectedAt: item.rejectedAt,
            rejectedBy: item.rejectedBy,
            comment: item.comment
          }))
        )
      };
    }
    case "aging": {
      const report = await getAgingReport(auth);

      return {
        fileName: "aging-report.csv",
        content: buildCsvContent(
          report.map((item) => ({
            employeeName: item.employeeName,
            categoryName: item.categoryName,
            amountCompanyCurrency: item.amountCompanyCurrency,
            companyCurrency: item.companyCurrency,
            submittedAt: item.submittedAt,
            daysPending: item.daysPending,
            currentStageName: item.currentStageName,
            pendingApprovers: item.pendingApprovers.join(" | ")
          }))
        )
      };
    }
  }
}
