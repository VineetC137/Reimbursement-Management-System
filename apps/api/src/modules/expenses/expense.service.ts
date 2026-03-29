import { unlink } from "node:fs/promises";

import { ApprovalActionType, ApprovalInstanceStatus, ExpenseStatus, Prisma, UserStatus } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { resolveReceiptPublicUrl } from "../../lib/storage.js";
import type { AuthContext } from "../../types/auth.js";
import {
  extractReceiptInsightsFromFile,
  mapReceiptInsightToPersistence,
  type ReceiptInsightSummary
} from "../ocr/receipt-ocr.service.js";
import { getWorkflowRecord } from "../workflows/workflow.service.js";
import type { WorkflowApproverSummary, WorkflowStageSummary } from "../workflows/workflow.types.js";
import { resolveExchangeRate } from "./currency-rate.service.js";
import type {
  ApprovalActionInput,
  CreateExpenseInput,
  OverrideExpenseInput,
  UpdateExpenseInput
} from "./expense.schema.js";
import type {
  ApprovalQueueItem,
  ExpenseActorSummary,
  ExpenseApprovalActionSummary,
  ExpenseCategorySummary,
  ExpenseSummary
} from "./expense.types.js";

type ApprovalSnapshot = {
  workflowId: string;
  workflowName: string;
  managerFirst: boolean;
  thresholdPercentage: number | null;
  specificApproverUserId: string | null;
  stages: WorkflowStageSummary[];
};

const expenseInclude = {
  category: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  receipts: {
    orderBy: {
      createdAt: "desc"
    }
  },
  approvalInstance: {
    include: {
      actions: {
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          actedAt: "asc"
        }
      }
    }
  }
} satisfies Prisma.ExpenseInclude;

type ExpenseRecord = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

type ApprovalActionRecord = NonNullable<ExpenseRecord["approvalInstance"]>["actions"][number];

function formatActor(user: { id: string; firstName: string; lastName: string; email: string }): ExpenseActorSummary {
  return {
    id: user.id,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email
  };
}

function formatCategory(category: { id: string; name: string; description: string | null }): ExpenseCategorySummary {
  return {
    id: category.id,
    name: category.name,
    description: category.description
  };
}

function formatApprovalAction(action: ApprovalActionRecord): ExpenseApprovalActionSummary {
  return {
    id: action.id,
    actor: formatActor(action.actor),
    action: action.action,
    comment: action.comment,
    stepOrder: action.stepOrder,
    actedAt: action.actedAt.toISOString()
  };
}

function buildDuplicateFingerprint(employeeId: string, input: Pick<CreateExpenseInput, "amount" | "currencyCode" | "expenseDate" | "categoryId" | "description">): string {
  const normalizedDescription = input.description.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);

  return [
    employeeId,
    input.categoryId,
    input.currencyCode.trim().toUpperCase(),
    input.amount.toFixed(2),
    new Date(input.expenseDate).toISOString().slice(0, 10),
    normalizedDescription
  ].join("|");
}

function normalizeExpenseDate(expenseDate: string): Date {
  const parsedDate = new Date(expenseDate);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(400, "INVALID_EXPENSE_DATE", "Expense date is invalid");
  }

  const tomorrow = new Date();
  tomorrow.setHours(23, 59, 59, 999);

  if (parsedDate > tomorrow) {
    throw new AppError(400, "INVALID_EXPENSE_DATE", "Expense date cannot be in the future");
  }

  return parsedDate;
}

function parseWorkflowSnapshot(value: Prisma.JsonValue | null): ApprovalSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const stages = Array.isArray(record.stages) ? record.stages : [];

  return {
    workflowId: typeof record.workflowId === "string" ? record.workflowId : "",
    workflowName: typeof record.workflowName === "string" ? record.workflowName : "Default Approval Workflow",
    managerFirst: Boolean(record.managerFirst),
    thresholdPercentage:
      typeof record.thresholdPercentage === "number" ? record.thresholdPercentage : null,
    specificApproverUserId:
      typeof record.specificApproverUserId === "string" ? record.specificApproverUserId : null,
    stages: stages.flatMap((stage) => {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
        return [];
      }

      const stageRecord = stage as Record<string, unknown>;
      const approvers = Array.isArray(stageRecord.approvers) ? stageRecord.approvers : [];

      return [
        {
          stepOrder: typeof stageRecord.stepOrder === "number" ? stageRecord.stepOrder : 0,
          name: typeof stageRecord.name === "string" ? stageRecord.name : "Approval Stage",
          isRequired: stageRecord.isRequired !== false,
          approvers: approvers.flatMap((approver) => {
            if (!approver || typeof approver !== "object" || Array.isArray(approver)) {
              return [];
            }

            const approverRecord = approver as Record<string, unknown>;

            if (
              typeof approverRecord.id !== "string" ||
              typeof approverRecord.fullName !== "string" ||
              typeof approverRecord.email !== "string"
            ) {
              return [];
            }

            return [
              {
                id: approverRecord.id,
                fullName: approverRecord.fullName,
                email: approverRecord.email
              }
            ];
          })
        }
      ];
    })
  };
}

async function getCompanyBaseCurrency(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: {
      id: companyId
    },
    select: {
      baseCurrency: true
    }
  });

  if (!company) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
  }

  return company.baseCurrency;
}

async function getExpenseCategoryForCompany(companyId: string, categoryId: string) {
  const category = await prisma.expenseCategory.findFirst({
    where: {
      id: categoryId,
      companyId,
      isActive: true,
      deletedAt: null
    }
  });

  if (!category) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Selected category was not found");
  }

  return category;
}

async function getActiveManagerForEmployee(employeeId: string, companyId: string): Promise<WorkflowApproverSummary | null> {
  const mapping = await prisma.managerMapping.findFirst({
    where: {
      companyId,
      employeeId,
      endedAt: null
    },
    orderBy: {
      effectiveAt: "desc"
    },
    include: {
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          deletedAt: true
        }
      }
    }
  });

  if (!mapping || mapping.manager.deletedAt || mapping.manager.status !== UserStatus.ACTIVE) {
    return null;
  }

  return formatActor(mapping.manager);
}

async function getFallbackAdminApprovers(companyId: string): Promise<WorkflowApproverSummary[]> {
  const admins = await prisma.user.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: UserStatus.ACTIVE,
      userRoles: {
        some: {
          role: {
            name: "ADMIN"
          }
        }
      }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  });

  return admins.map(formatActor);
}

async function buildApprovalSnapshot(companyId: string, employeeId: string): Promise<ApprovalSnapshot> {
  const workflow = await getWorkflowRecord(companyId);
  const thresholdRule = workflow.rules
    .flatMap((rule) => rule.conditions)
    .find((condition) => condition.field === "thresholdPercentage");
  const specificApproverRule = workflow.rules
    .flatMap((rule) => rule.conditions)
    .find((condition) => condition.field === "specificApproverUserId");

  const stages: WorkflowStageSummary[] = [];
  const activeManager = workflow.managerFirst ? await getActiveManagerForEmployee(employeeId, companyId) : null;

  if (activeManager) {
    stages.push({
      stepOrder: 0,
      name: "Reporting Manager Review",
      isRequired: true,
      approvers: [activeManager]
    });
  }

  stages.push(
    ...workflow.steps
      .map((step) => ({
        stepOrder: step.stepOrder,
        name: step.name,
        isRequired: step.isRequired,
        approvers: step.stepApprovers.map((stepApprover) => formatActor(stepApprover.approver))
      }))
      .filter((stage) => stage.approvers.length > 0)
  );

  if (stages.length === 0) {
    const fallbackAdmins = await getFallbackAdminApprovers(companyId);

    if (fallbackAdmins.length === 0) {
      throw new AppError(
        409,
        "NO_APPROVERS_CONFIGURED",
        "No approvers are configured yet. Add a workflow step or manager mapping before submitting an expense."
      );
    }

    stages.push({
      stepOrder: 1,
      name: "Admin Review",
      isRequired: true,
      approvers: fallbackAdmins
    });
  }

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    managerFirst: workflow.managerFirst,
    thresholdPercentage: thresholdRule ? Number(thresholdRule.value) : null,
    specificApproverUserId: specificApproverRule?.value ?? null,
    stages
  };
}

async function getExpenseById(expenseId: string, companyId: string): Promise<ExpenseRecord> {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      companyId,
      deletedAt: null
    },
    include: expenseInclude
  });

  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense was not found");
  }

  return expense;
}

function ensureUserCanReadExpense(expense: ExpenseRecord, auth: AuthContext): void {
  if (auth.roles.includes("ADMIN")) {
    return;
  }

  if (expense.employee.id === auth.userId) {
    return;
  }

  throw new AppError(403, "EXPENSE_ACCESS_DENIED", "You do not have access to this expense");
}

function getPendingApproversForStage(
  stage: WorkflowStageSummary | null,
  actions: ApprovalActionRecord[]
): ExpenseActorSummary[] {
  if (!stage) {
    return [];
  }

  const actedApproverIds = new Set(
    actions.filter((action) => action.stepOrder === stage.stepOrder).map((action) => action.actor.id)
  );

  return stage.approvers.filter((approver) => !actedApproverIds.has(approver.id));
}

async function resolveSnapshotForExpense(expense: ExpenseRecord): Promise<ApprovalSnapshot | null> {
  if (!expense.approvalInstance) {
    return null;
  }

  const snapshotFromInstance = parseWorkflowSnapshot(expense.approvalInstance.workflowSnapshot);

  if (snapshotFromInstance) {
    return snapshotFromInstance;
  }

  return buildApprovalSnapshot(expense.companyId, expense.employee.id);
}

function serializeReceipt(receipt: ExpenseRecord["receipts"][number] | undefined) {
  if (!receipt) {
    return null;
  }

  return {
    id: receipt.id,
    sourceType: receipt.sourceType,
    fileName: receipt.fileName,
    fileUrl: receipt.fileUrl,
    mimeType: receipt.mimeType,
    ocrStatus: receipt.ocrStatus,
    ocrErrorMessage: receipt.ocrErrorMessage,
    extractedAmount: receipt.extractedAmount?.toString() ?? null,
    extractedCurrency: receipt.extractedCurrency,
    extractedDate: receipt.extractedDate?.toISOString() ?? null,
    extractedMerchantName: receipt.extractedMerchantName,
    suggestedDescription: receipt.suggestedDescription,
    suggestedCategoryName: receipt.suggestedCategoryName,
    ocrConfidence: receipt.ocrConfidence?.toString() ?? null
  };
}

async function serializeExpense(expense: ExpenseRecord): Promise<ExpenseSummary> {
  const snapshot = await resolveSnapshotForExpense(expense);
  const currentStage =
    snapshot && expense.approvalInstance
      ? snapshot.stages.find((stage) => stage.stepOrder === expense.approvalInstance?.currentStepOrder) ?? null
      : null;
  const actions = expense.approvalInstance?.actions ?? [];

  return {
    id: expense.id,
    status: expense.status,
    amountOriginal: expense.amountOriginal.toString(),
    originalCurrency: expense.originalCurrency,
    amountCompanyCurrency: expense.amountCompanyCurrency.toString(),
    companyCurrency: expense.companyCurrency,
    exchangeRate: expense.exchangeRate.toString(),
    expenseDate: expense.expenseDate.toISOString(),
    description: expense.description,
    submittedAt: expense.submittedAt?.toISOString() ?? null,
    createdAt: expense.createdAt.toISOString(),
    category: formatCategory(expense.category),
    employee: formatActor(expense.employee),
    receipt: serializeReceipt(expense.receipts[0]),
    approval: {
      instanceId: expense.approvalInstance?.id ?? null,
      status: expense.approvalInstance?.status ?? null,
      currentStepOrder: expense.approvalInstance?.currentStepOrder ?? null,
      currentStageName: currentStage?.name ?? null,
      pendingApprovers: getPendingApproversForStage(currentStage, actions),
      thresholdPercentage: snapshot?.thresholdPercentage ?? null,
      specificApproverUserId: snapshot?.specificApproverUserId ?? null,
      actions: actions.map(formatApprovalAction)
    }
  };
}

async function deleteStoredFiles(paths: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    paths.filter((value): value is string => Boolean(value)).map(async (filePath) => {
      try {
        await unlink(filePath);
      } catch {
        // Ignore best-effort cleanup failures for replaced local files.
      }
    })
  );
}

async function clearExpenseReceipts(
  client: Prisma.TransactionClient,
  expenseId: string
): Promise<Array<string | null | undefined>> {
  const existingReceipts = await client.expenseReceipt.findMany({
    where: {
      expenseId
    },
    select: {
      storagePath: true
    }
  });

  await client.expenseReceipt.deleteMany({
    where: {
      expenseId
    }
  });

  return existingReceipts.map((receipt) => receipt.storagePath);
}

async function syncExpenseReceipt(
  client: Prisma.TransactionClient,
  expenseId: string,
  uploadedById: string,
  receiptUrl: string | null | undefined
): Promise<void> {
  await clearExpenseReceipts(client, expenseId);

  if (!receiptUrl) {
    return;
  }

  const trimmedUrl = receiptUrl.trim();
  const parsedUrl = new URL(trimmedUrl);
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const fileName = pathSegments[pathSegments.length - 1] || "receipt-link";

  await client.expenseReceipt.create({
    data: {
      expenseId,
      sourceType: "URL",
      fileName,
      fileUrl: trimmedUrl,
      mimeType: "text/url",
      fileSizeBytes: trimmedUrl.length,
      uploadedById,
      ocrStatus: "NOT_SUPPORTED",
      ocrErrorMessage: "OCR is available only for uploaded local receipt files."
    }
  });
}

async function createNotifications(
  client: Prisma.TransactionClient,
  companyId: string,
  userIds: string[],
  title: string,
  message: string,
  payload: Prisma.InputJsonValue
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return;
  }

  await client.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      companyId,
      userId,
      title,
      message,
      payload
    }))
  });
}

async function getSuggestedCategoryId(
  companyId: string,
  categoryName: string | null | undefined
): Promise<string | null> {
  if (!categoryName) {
    return null;
  }

  const category = await prisma.expenseCategory.findFirst({
    where: {
      companyId,
      name: categoryName,
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  return category?.id ?? null;
}

function ensureUserCanEditReceipt(expense: ExpenseRecord, auth: AuthContext): void {
  if (auth.roles.includes("ADMIN")) {
    return;
  }

  if (expense.employee.id !== auth.userId) {
    throw new AppError(403, "EXPENSE_ACCESS_DENIED", "Only the expense owner can change this receipt");
  }

  if (expense.status !== ExpenseStatus.DRAFT) {
    throw new AppError(409, "EXPENSE_NOT_EDITABLE", "Only draft expenses can accept receipt changes");
  }
}

export async function uploadExpenseReceipt(
  auth: AuthContext,
  expenseId: string,
  uploadedFile: Express.Multer.File
): Promise<{ expense: ExpenseSummary; extraction: ReceiptInsightSummary }> {
  const expense = await getExpenseById(expenseId, auth.companyId);
  ensureUserCanEditReceipt(expense, auth);

  const extraction = await extractReceiptInsightsFromFile(uploadedFile.path, uploadedFile.mimetype);
  let replacedPaths: Array<string | null | undefined> = [];

  try {
    const updatedExpense = await prisma.$transaction(async (client) => {
      replacedPaths = await clearExpenseReceipts(client, expense.id);

      await client.expenseReceipt.create({
        data: {
          expenseId: expense.id,
          sourceType: "UPLOAD",
          storagePath: uploadedFile.path,
          fileName: uploadedFile.originalname,
          fileUrl: resolveReceiptPublicUrl(uploadedFile.filename),
          mimeType: uploadedFile.mimetype,
          fileSizeBytes: uploadedFile.size,
          uploadedById: auth.userId,
          ...mapReceiptInsightToPersistence(extraction)
        }
      });

      await client.auditLog.create({
        data: {
          companyId: auth.companyId,
          userId: auth.userId,
          expenseId: expense.id,
          entityType: "EXPENSE_RECEIPT",
          entityId: expense.id,
          action: "UPLOAD_RECEIPT",
          newValue: {
            fileName: uploadedFile.originalname,
            ocrStatus: extraction.status,
            suggestedCategoryName: extraction.suggestedCategoryName
          }
        }
      });

      return client.expense.findUniqueOrThrow({
        where: {
          id: expense.id
        },
        include: expenseInclude
      });
    });

    await deleteStoredFiles(replacedPaths);

    return {
      expense: await serializeExpense(updatedExpense),
      extraction
    };
  } catch (error) {
    await deleteStoredFiles([uploadedFile.path]);
    throw error;
  }
}

export async function applyReceiptOcrToExpense(auth: AuthContext, expenseId: string): Promise<ExpenseSummary> {
  const expense = await getExpenseById(expenseId, auth.companyId);
  ensureUserCanEditReceipt(expense, auth);

  const receipt = expense.receipts[0];

  if (!receipt) {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Upload a receipt before applying OCR suggestions");
  }

  if (!receipt.extractedAmount && !receipt.extractedDate && !receipt.suggestedDescription && !receipt.suggestedCategoryName) {
    throw new AppError(409, "OCR_NOT_READY", "No OCR-extracted values are available for this receipt");
  }

  const companyCurrency = await getCompanyBaseCurrency(auth.companyId);
  const originalCurrency = receipt.extractedCurrency ?? expense.originalCurrency;
  const amountOriginal = receipt.extractedAmount ?? expense.amountOriginal;
  const exchangeRate = await resolveExchangeRate(auth.companyId, originalCurrency, companyCurrency);
  const amountCompanyCurrency = amountOriginal.mul(exchangeRate.rate).toDecimalPlaces(2);
  const nextExpenseDate = receipt.extractedDate ?? expense.expenseDate;
  const nextDescription = receipt.suggestedDescription ?? expense.description ?? "Receipt-based expense";
  const suggestedCategoryId =
    (await getSuggestedCategoryId(auth.companyId, receipt.suggestedCategoryName)) ?? expense.categoryId;
  const duplicateFingerprint = buildDuplicateFingerprint(expense.employee.id, {
    categoryId: suggestedCategoryId,
    amount: Number(amountOriginal.toFixed(2)),
    currencyCode: originalCurrency,
    expenseDate: nextExpenseDate.toISOString(),
    description: nextDescription
  });

  const updatedExpense = await prisma.$transaction(async (client) => {
    await client.expense.update({
      where: {
        id: expense.id
      },
      data: {
        categoryId: suggestedCategoryId,
        amountOriginal,
        originalCurrency,
        amountCompanyCurrency,
        companyCurrency,
        exchangeRate: exchangeRate.rate,
        expenseDate: nextExpenseDate,
        description: nextDescription,
        duplicateFingerprint
      }
    });

    await client.expenseReceipt.update({
      where: {
        id: receipt.id
      },
      data: {
        extractionReviewed: true
      }
    });

    await client.auditLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        expenseId: expense.id,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: "APPLY_RECEIPT_OCR",
        newValue: {
          originalCurrency,
          amountOriginal: amountOriginal.toString(),
          suggestedCategoryId
        }
      }
    });

    return client.expense.findUniqueOrThrow({
      where: {
        id: expense.id
      },
      include: expenseInclude
    });
  });

  return serializeExpense(updatedExpense);
}

function evaluateApprovalProgress(
  snapshot: ApprovalSnapshot,
  currentStepOrder: number,
  actions: Array<{
    actorId: string;
    stepOrder: number;
    action: ApprovalActionType;
  }>
):
  | { outcome: "PENDING"; nextStepOrder: number }
  | { outcome: "APPROVED" }
  | { outcome: "REJECTED" } {
  const totalApproverIds = [...new Set(snapshot.stages.flatMap((stage) => stage.approvers.map((approver) => approver.id)))];
  const currentStage = snapshot.stages.find((stage) => stage.stepOrder === currentStepOrder) ?? null;

  if (!currentStage) {
    return { outcome: "APPROVED" };
  }

  const currentStepActions = actions.filter((action) => action.stepOrder === currentStepOrder);

  if (currentStepActions.some((action) => action.action === ApprovalActionType.REJECT)) {
    return { outcome: "REJECTED" };
  }

  const approvedApproverIds = new Set(
    actions
      .filter((action) => action.action === ApprovalActionType.APPROVE)
      .map((action) => action.actorId)
  );

  if (snapshot.specificApproverUserId && approvedApproverIds.has(snapshot.specificApproverUserId)) {
    return { outcome: "APPROVED" };
  }

  if (
    snapshot.thresholdPercentage &&
    totalApproverIds.length > 0 &&
    approvedApproverIds.size / totalApproverIds.length >= snapshot.thresholdPercentage / 100
  ) {
    return { outcome: "APPROVED" };
  }

  const currentStageApproverIds = currentStage.approvers.map((approver) => approver.id);
  const currentStageApprovedIds = new Set(
    currentStepActions.filter((action) => action.action === ApprovalActionType.APPROVE).map((action) => action.actorId)
  );
  const currentStageComplete = currentStageApproverIds.every((approverId) => currentStageApprovedIds.has(approverId));

  if (!currentStageComplete) {
    return { outcome: "PENDING", nextStepOrder: currentStepOrder };
  }

  const currentStageIndex = snapshot.stages.findIndex((stage) => stage.stepOrder === currentStepOrder);
  const nextStage = snapshot.stages[currentStageIndex + 1] ?? null;

  if (!nextStage) {
    return { outcome: "APPROVED" };
  }

  return {
    outcome: "PENDING",
    nextStepOrder: nextStage.stepOrder
  };
}

export async function listExpenseCategories(companyId: string): Promise<ExpenseCategorySummary[]> {
  const categories = await prisma.expenseCategory.findMany({
    where: {
      companyId,
      isActive: true,
      deletedAt: null
    },
    orderBy: {
      name: "asc"
    }
  });

  return categories.map(formatCategory);
}

export async function listExpenses(auth: AuthContext): Promise<ExpenseSummary[]> {
  const where: Prisma.ExpenseWhereInput = {
    companyId: auth.companyId,
    deletedAt: null
  };

  if (!auth.roles.includes("ADMIN")) {
    if (auth.roles.includes("MANAGER")) {
      const reportees = await prisma.managerMapping.findMany({
        where: {
          companyId: auth.companyId,
          managerId: auth.userId,
          endedAt: null
        },
        select: {
          employeeId: true
        }
      });

      where.employeeId = {
        in: [auth.userId, ...reportees.map((reportee) => reportee.employeeId)]
      };
    } else {
      where.employeeId = auth.userId;
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [
      {
        expenseDate: "desc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return Promise.all(expenses.map((expense) => serializeExpense(expense)));
}

export async function createExpense(companyId: string, employeeId: string, input: CreateExpenseInput): Promise<ExpenseSummary> {
  const companyCurrency = await getCompanyBaseCurrency(companyId);
  const category = await getExpenseCategoryForCompany(companyId, input.categoryId);
  const expenseDate = normalizeExpenseDate(input.expenseDate);
  const originalCurrency = input.currencyCode.trim().toUpperCase();
  const exchangeRate = await resolveExchangeRate(companyId, originalCurrency, companyCurrency);
  const amountOriginal = new Prisma.Decimal(input.amount.toFixed(2));
  const amountCompanyCurrency = amountOriginal.mul(exchangeRate.rate).toDecimalPlaces(2);
  const duplicateFingerprint = buildDuplicateFingerprint(employeeId, input);

  const createdExpense = await prisma.$transaction(async (client) => {
    const expense = await client.expense.create({
      data: {
        companyId,
        employeeId,
        categoryId: category.id,
        amountOriginal,
        originalCurrency,
        amountCompanyCurrency,
        companyCurrency,
        exchangeRate: exchangeRate.rate,
        expenseDate,
        description: input.description.trim(),
        duplicateFingerprint,
        status: ExpenseStatus.DRAFT
      }
    });

    await syncExpenseReceipt(client, expense.id, employeeId, input.receiptUrl);

    await client.auditLog.create({
      data: {
        companyId,
        userId: employeeId,
        expenseId: expense.id,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: "CREATE_EXPENSE_DRAFT",
        newValue: {
          amountOriginal: amountOriginal.toString(),
          originalCurrency,
          amountCompanyCurrency: amountCompanyCurrency.toString(),
          categoryName: category.name
        }
      }
    });

    return client.expense.findUniqueOrThrow({
      where: {
        id: expense.id
      },
      include: expenseInclude
    });
  });

  return serializeExpense(createdExpense);
}

export async function updateExpense(
  companyId: string,
  employeeId: string,
  expenseId: string,
  input: UpdateExpenseInput
): Promise<ExpenseSummary> {
  const existingExpense = await getExpenseById(expenseId, companyId);

  if (existingExpense.employee.id !== employeeId) {
    throw new AppError(403, "EXPENSE_ACCESS_DENIED", "Only the expense owner can edit this expense");
  }

  if (existingExpense.status !== ExpenseStatus.DRAFT) {
    throw new AppError(409, "EXPENSE_NOT_EDITABLE", "Only draft expenses can be edited");
  }

  const companyCurrency = await getCompanyBaseCurrency(companyId);
  const category = await getExpenseCategoryForCompany(companyId, input.categoryId);
  const expenseDate = normalizeExpenseDate(input.expenseDate);
  const originalCurrency = input.currencyCode.trim().toUpperCase();
  const exchangeRate = await resolveExchangeRate(companyId, originalCurrency, companyCurrency);
  const amountOriginal = new Prisma.Decimal(input.amount.toFixed(2));
  const amountCompanyCurrency = amountOriginal.mul(exchangeRate.rate).toDecimalPlaces(2);
  const duplicateFingerprint = buildDuplicateFingerprint(employeeId, input);

  const updatedExpense = await prisma.$transaction(async (client) => {
    const expense = await client.expense.update({
      where: {
        id: expenseId
      },
      data: {
        categoryId: category.id,
        amountOriginal,
        originalCurrency,
        amountCompanyCurrency,
        companyCurrency,
        exchangeRate: exchangeRate.rate,
        expenseDate,
        description: input.description.trim(),
        duplicateFingerprint
      }
    });

    await syncExpenseReceipt(client, expense.id, employeeId, input.receiptUrl);

    await client.auditLog.create({
      data: {
        companyId,
        userId: employeeId,
        expenseId: expense.id,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: "UPDATE_EXPENSE_DRAFT"
      }
    });

    return client.expense.findUniqueOrThrow({
      where: {
        id: expense.id
      },
      include: expenseInclude
    });
  });

  return serializeExpense(updatedExpense);
}

export async function submitExpense(companyId: string, employeeId: string, expenseId: string): Promise<ExpenseSummary> {
  const expense = await getExpenseById(expenseId, companyId);

  if (expense.employee.id !== employeeId) {
    throw new AppError(403, "EXPENSE_ACCESS_DENIED", "Only the expense owner can submit this expense");
  }

  if (expense.status !== ExpenseStatus.DRAFT) {
    throw new AppError(409, "EXPENSE_NOT_SUBMITTABLE", "Only draft expenses can be submitted");
  }

  const snapshot = await buildApprovalSnapshot(companyId, employeeId);
  const firstStage = snapshot.stages[0] ?? null;

  if (!firstStage) {
    throw new AppError(409, "NO_APPROVERS_CONFIGURED", "No approvers are configured for this expense");
  }

  const submittedExpense = await prisma.$transaction(async (client) => {
    const updatedExpense = await client.expense.update({
      where: {
        id: expense.id
      },
      data: {
        status: ExpenseStatus.IN_REVIEW,
        submittedAt: new Date()
      }
    });

    const instance = await client.expenseApprovalInstance.create({
      data: {
        expenseId: updatedExpense.id,
        workflowId: snapshot.workflowId,
        currentStepOrder: firstStage.stepOrder,
        status: ApprovalInstanceStatus.IN_PROGRESS,
        workflowSnapshot: snapshot as unknown as Prisma.InputJsonValue
      }
    });

    await client.auditLog.create({
      data: {
        companyId,
        userId: employeeId,
        expenseId: updatedExpense.id,
        entityType: "EXPENSE",
        entityId: updatedExpense.id,
        action: "SUBMIT_EXPENSE",
        newValue: {
          approvalInstanceId: instance.id,
          currentStepOrder: firstStage.stepOrder
        }
      }
    });

    await createNotifications(
      client,
      companyId,
      firstStage.approvers.map((approver) => approver.id),
      "Expense waiting for approval",
      `${expense.employee.firstName} ${expense.employee.lastName}`.trim() + " submitted an expense for review.",
      {
        expenseId: updatedExpense.id,
        currentStepOrder: firstStage.stepOrder
      }
    );

    return client.expense.findUniqueOrThrow({
      where: {
        id: updatedExpense.id
      },
      include: expenseInclude
    });
  });

  return serializeExpense(submittedExpense);
}

export async function listApprovalQueue(auth: AuthContext): Promise<ApprovalQueueItem[]> {
  if (!auth.roles.includes("MANAGER") && !auth.roles.includes("ADMIN")) {
    return [];
  }

  const expenses = await prisma.expense.findMany({
    where: {
      companyId: auth.companyId,
      deletedAt: null,
      status: ExpenseStatus.IN_REVIEW,
      approvalInstance: {
        is: {
          status: ApprovalInstanceStatus.IN_PROGRESS
        }
      }
    },
    include: expenseInclude,
    orderBy: {
      submittedAt: "asc"
    }
  });

  const serializedExpenses = await Promise.all(expenses.map((expense) => serializeExpense(expense)));

  return serializedExpenses.filter((expense) =>
    expense.approval.pendingApprovers.some((approver) => approver.id === auth.userId)
  );
}

export async function actOnExpense(
  auth: AuthContext,
  expenseId: string,
  input: ApprovalActionInput
): Promise<ExpenseSummary> {
  const expense = await getExpenseById(expenseId, auth.companyId);

  if (!expense.approvalInstance || expense.status !== ExpenseStatus.IN_REVIEW) {
    throw new AppError(409, "EXPENSE_NOT_PENDING", "This expense is not waiting for approval");
  }

  const snapshot = await resolveSnapshotForExpense(expense);

  if (!snapshot) {
    throw new AppError(409, "APPROVAL_SNAPSHOT_MISSING", "Approval workflow snapshot could not be resolved");
  }

  const currentStage =
    snapshot.stages.find((stage) => stage.stepOrder === expense.approvalInstance?.currentStepOrder) ?? null;

  if (!currentStage) {
    throw new AppError(409, "CURRENT_STAGE_INVALID", "Current approval stage is invalid");
  }

  const pendingApprover = getPendingApproversForStage(currentStage, expense.approvalInstance.actions).find(
    (approver) => approver.id === auth.userId
  );

  if (!pendingApprover) {
    throw new AppError(403, "APPROVAL_ACCESS_DENIED", "You are not the current approver for this expense");
  }

  if (input.action === "REJECT" && (!input.comment || input.comment.trim().length < 3)) {
    throw new AppError(400, "COMMENT_REQUIRED", "Add a short rejection comment before rejecting");
  }

  const actionType = input.action === "APPROVE" ? ApprovalActionType.APPROVE : ApprovalActionType.REJECT;

  const updatedExpense = await prisma.$transaction(async (client) => {
    const createdAction = await client.expenseApprovalAction.create({
      data: {
        instanceId: expense.approvalInstance!.id,
        stepOrder: currentStage.stepOrder,
        actorId: auth.userId,
        action: actionType,
        comment: input.comment?.trim() || null,
        fromStatus: expense.status,
        toStatus: input.action === "APPROVE" ? ExpenseStatus.IN_REVIEW : ExpenseStatus.REJECTED
      }
    });

    const nextActions = [
      ...expense.approvalInstance!.actions.map((action) => ({
        actorId: action.actor.id,
        stepOrder: action.stepOrder,
        action: action.action
      })),
      {
        actorId: auth.userId,
        stepOrder: currentStage.stepOrder,
        action: createdAction.action
      }
    ];

    const evaluation = evaluateApprovalProgress(snapshot, currentStage.stepOrder, nextActions);
    let nextExpenseStatus: ExpenseStatus = ExpenseStatus.IN_REVIEW;
    let nextInstanceStatus: ApprovalInstanceStatus = ApprovalInstanceStatus.IN_PROGRESS;
    let completedAt: Date | null = null;
    let nextStepOrder = expense.approvalInstance!.currentStepOrder;

    if (evaluation.outcome === "APPROVED") {
      nextExpenseStatus = ExpenseStatus.APPROVED;
      nextInstanceStatus = ApprovalInstanceStatus.APPROVED;
      completedAt = new Date();
    }

    if (evaluation.outcome === "REJECTED") {
      nextExpenseStatus = ExpenseStatus.REJECTED;
      nextInstanceStatus = ApprovalInstanceStatus.REJECTED;
      completedAt = new Date();
    }

    if (evaluation.outcome === "PENDING") {
      nextStepOrder = evaluation.nextStepOrder;
    }

    await client.expense.update({
      where: {
        id: expense.id
      },
      data: {
        status: nextExpenseStatus
      }
    });

    await client.expenseApprovalInstance.update({
      where: {
        id: expense.approvalInstance!.id
      },
      data: {
        currentStepOrder: nextStepOrder,
        status: nextInstanceStatus,
        completedAt
      }
    });

    await client.auditLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        expenseId: expense.id,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: input.action === "APPROVE" ? "APPROVE_EXPENSE" : "REJECT_EXPENSE",
        reason: input.comment?.trim() || null
      }
    });

    if (evaluation.outcome === "PENDING" && nextStepOrder !== currentStage.stepOrder) {
      const nextStage = snapshot.stages.find((stage) => stage.stepOrder === nextStepOrder) ?? null;

      if (nextStage) {
        await createNotifications(
          client,
          auth.companyId,
          nextStage.approvers.map((approver) => approver.id),
          "Expense waiting for your action",
          `${expense.employee.firstName} ${expense.employee.lastName}`.trim() + " has an expense waiting in your queue.",
          {
            expenseId: expense.id,
            currentStepOrder: nextStepOrder
          }
        );
      }
    }

    if (evaluation.outcome === "APPROVED" || evaluation.outcome === "REJECTED") {
      await createNotifications(
        client,
        auth.companyId,
        [expense.employee.id],
        evaluation.outcome === "APPROVED" ? "Expense approved" : "Expense rejected",
        evaluation.outcome === "APPROVED"
          ? "Your expense has completed the approval workflow."
          : "Your expense was rejected during the approval workflow.",
        {
          expenseId: expense.id,
          finalStatus: evaluation.outcome,
          comment: input.comment?.trim() || null
        }
      );
    }

    return client.expense.findUniqueOrThrow({
      where: {
        id: expense.id
      },
      include: expenseInclude
    });
  });

  return serializeExpense(updatedExpense);
}

export async function overrideExpense(
  auth: AuthContext,
  expenseId: string,
  input: OverrideExpenseInput
): Promise<ExpenseSummary> {
  if (!auth.roles.includes("ADMIN")) {
    throw new AppError(403, "OVERRIDE_FORBIDDEN", "Only admins can override an expense outcome");
  }

  const expense = await getExpenseById(expenseId, auth.companyId);

  if (!expense.approvalInstance || expense.status !== ExpenseStatus.IN_REVIEW) {
    throw new AppError(409, "EXPENSE_NOT_PENDING", "This expense is not waiting for approval");
  }

  const updatedExpense = await prisma.$transaction(async (client) => {
    await client.expenseApprovalAction.create({
      data: {
        instanceId: expense.approvalInstance!.id,
        stepOrder: expense.approvalInstance!.currentStepOrder,
        actorId: auth.userId,
        action: input.action === "APPROVE" ? ApprovalActionType.OVERRIDE_APPROVE : ApprovalActionType.OVERRIDE_REJECT,
        comment: input.comment.trim(),
        fromStatus: expense.status,
        toStatus: input.action === "APPROVE" ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED
      }
    });

    await client.expense.update({
      where: {
        id: expense.id
      },
      data: {
        status: input.action === "APPROVE" ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED
      }
    });

    await client.expenseApprovalInstance.update({
      where: {
        id: expense.approvalInstance!.id
      },
      data: {
        status: ApprovalInstanceStatus.OVERRIDDEN,
        completedAt: new Date()
      }
    });

    await client.auditLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        expenseId: expense.id,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: input.action === "APPROVE" ? "OVERRIDE_APPROVE_EXPENSE" : "OVERRIDE_REJECT_EXPENSE",
        reason: input.comment.trim()
      }
    });

    await createNotifications(
      client,
      auth.companyId,
      [expense.employee.id],
      input.action === "APPROVE" ? "Expense approved by admin" : "Expense rejected by admin",
      input.action === "APPROVE"
        ? "An admin override approved your expense."
        : "An admin override rejected your expense.",
      {
        expenseId: expense.id,
        finalStatus: input.action,
        comment: input.comment.trim()
      }
    );

    return client.expense.findUniqueOrThrow({
      where: {
        id: expense.id
      },
      include: expenseInclude
    });
  });

  return serializeExpense(updatedExpense);
}

export async function getExpenseDetail(auth: AuthContext, expenseId: string): Promise<ExpenseSummary> {
  const expense = await getExpenseById(expenseId, auth.companyId);
  ensureUserCanReadExpense(expense, auth);
  return serializeExpense(expense);
}
