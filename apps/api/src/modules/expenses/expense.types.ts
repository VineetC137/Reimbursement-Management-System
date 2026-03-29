export type ExpenseCategorySummary = {
  id: string;
  name: string;
  description: string | null;
};

export type ExpenseActorSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type ExpenseApprovalActionSummary = {
  id: string;
  actor: ExpenseActorSummary;
  action: string;
  comment: string | null;
  stepOrder: number;
  actedAt: string;
};

export type ExpenseSummary = {
  id: string;
  status: string;
  amountOriginal: string;
  originalCurrency: string;
  amountCompanyCurrency: string;
  companyCurrency: string;
  exchangeRate: string;
  expenseDate: string;
  description: string | null;
  submittedAt: string | null;
  createdAt: string;
  category: ExpenseCategorySummary;
  employee: ExpenseActorSummary;
  receipt: {
    id: string;
    sourceType: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    ocrStatus: string;
    ocrErrorMessage: string | null;
    extractedAmount: string | null;
    extractedCurrency: string | null;
    extractedDate: string | null;
    extractedMerchantName: string | null;
    suggestedDescription: string | null;
    suggestedCategoryName: string | null;
    ocrConfidence: string | null;
  } | null;
  approval: {
    instanceId: string | null;
    status: string | null;
    currentStepOrder: number | null;
    currentStageName: string | null;
    pendingApprovers: ExpenseActorSummary[];
    thresholdPercentage: number | null;
    specificApproverUserId: string | null;
    actions: ExpenseApprovalActionSummary[];
  };
};

export type ApprovalQueueItem = ExpenseSummary;
