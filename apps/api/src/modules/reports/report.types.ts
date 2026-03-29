export type ReportDashboardSummary = {
  totalExpenses: number;
  draftExpenses: number;
  inReviewExpenses: number;
  approvedExpenses: number;
  rejectedExpenses: number;
  approvedAmountCompanyCurrency: string;
  inReviewAmountCompanyCurrency: string;
};

export type PendingByApproverItem = {
  approverId: string;
  approverName: string;
  approverEmail: string;
  pendingCount: number;
};

export type RejectionReportItem = {
  expenseId: string;
  employeeName: string;
  categoryName: string;
  amountCompanyCurrency: string;
  companyCurrency: string;
  rejectedAt: string | null;
  rejectedBy: string | null;
  comment: string | null;
};

export type AgingReportItem = {
  expenseId: string;
  employeeName: string;
  categoryName: string;
  amountCompanyCurrency: string;
  companyCurrency: string;
  submittedAt: string | null;
  daysPending: number;
  currentStageName: string | null;
  pendingApprovers: string[];
};
