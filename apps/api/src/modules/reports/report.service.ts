import { ExpenseStatus, Prisma } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthContext } from "../../types/auth.js";
import type {
  AgingReportItem,
  PendingByApproverItem,
  RejectionReportItem,
  ReportDashboardSummary
} from "./report.types.js";

type WorkflowSnapshotStage = {
  stepOrder: number;
  name: string;
  approvers: Array<{
    id: string;
    fullName: string;
    email: string;
  }>;
};

type WorkflowSnapshot = {
  stages: WorkflowSnapshotStage[];
};

function parseWorkflowSnapshot(value: Prisma.JsonValue | null): WorkflowSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { stages: [] };
  }

  const stages = Array.isArray((value as Record<string, unknown>).stages)
    ? ((value as Record<string, unknown>).stages as unknown[])
    : [];

  return {
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

async function getScopedEmployeeIds(auth: AuthContext): Promise<string[] | null> {
  if (auth.roles.includes("ADMIN")) {
    return null;
  }

  if (!auth.roles.includes("MANAGER")) {
    return [auth.userId];
  }

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

  return [auth.userId, ...reportees.map((reportee) => reportee.employeeId)];
}

function buildScopedWhere(companyId: string, employeeIds: string[] | null): Prisma.ExpenseWhereInput {
  return {
    companyId,
    deletedAt: null,
    ...(employeeIds ? { employeeId: { in: employeeIds } } : {})
  };
}

export async function getDashboardReport(auth: AuthContext): Promise<ReportDashboardSummary> {
  if (!auth.roles.includes("ADMIN") && !auth.roles.includes("MANAGER")) {
    throw new AppError(403, "REPORT_ACCESS_DENIED", "You do not have access to reporting");
  }

  const scopedEmployeeIds = await getScopedEmployeeIds(auth);
  const expenses = await prisma.expense.findMany({
    where: buildScopedWhere(auth.companyId, scopedEmployeeIds),
    select: {
      status: true,
      amountCompanyCurrency: true
    }
  });

  const totalAmounts = {
    approved: new Prisma.Decimal(0),
    inReview: new Prisma.Decimal(0)
  };

  for (const expense of expenses) {
    if (expense.status === ExpenseStatus.APPROVED) {
      totalAmounts.approved = totalAmounts.approved.add(expense.amountCompanyCurrency);
    }

    if (expense.status === ExpenseStatus.IN_REVIEW) {
      totalAmounts.inReview = totalAmounts.inReview.add(expense.amountCompanyCurrency);
    }
  }

  return {
    totalExpenses: expenses.length,
    draftExpenses: expenses.filter((expense) => expense.status === ExpenseStatus.DRAFT).length,
    inReviewExpenses: expenses.filter((expense) => expense.status === ExpenseStatus.IN_REVIEW).length,
    approvedExpenses: expenses.filter((expense) => expense.status === ExpenseStatus.APPROVED).length,
    rejectedExpenses: expenses.filter((expense) => expense.status === ExpenseStatus.REJECTED).length,
    approvedAmountCompanyCurrency: totalAmounts.approved.toFixed(2),
    inReviewAmountCompanyCurrency: totalAmounts.inReview.toFixed(2)
  };
}

export async function getPendingByApproverReport(auth: AuthContext): Promise<PendingByApproverItem[]> {
  if (!auth.roles.includes("ADMIN") && !auth.roles.includes("MANAGER")) {
    throw new AppError(403, "REPORT_ACCESS_DENIED", "You do not have access to reporting");
  }

  const scopedEmployeeIds = await getScopedEmployeeIds(auth);
  const expenses = await prisma.expense.findMany({
    where: {
      ...buildScopedWhere(auth.companyId, scopedEmployeeIds),
      status: ExpenseStatus.IN_REVIEW,
      approvalInstance: {
        is: {
          status: "IN_PROGRESS"
        }
      }
    },
    select: {
      approvalInstance: {
        select: {
          currentStepOrder: true,
          workflowSnapshot: true
        }
      }
    }
  });

  const pendingMap = new Map<string, PendingByApproverItem>();

  for (const expense of expenses) {
    const instance = expense.approvalInstance;

    if (!instance) {
      continue;
    }

    const snapshot = parseWorkflowSnapshot(instance.workflowSnapshot);
    const currentStage = snapshot.stages.find((stage) => stage.stepOrder === instance.currentStepOrder) ?? null;

    if (!currentStage) {
      continue;
    }

    for (const approver of currentStage.approvers) {
      const existingItem = pendingMap.get(approver.id);

      if (existingItem) {
        existingItem.pendingCount += 1;
      } else {
        pendingMap.set(approver.id, {
          approverId: approver.id,
          approverName: approver.fullName,
          approverEmail: approver.email,
          pendingCount: 1
        });
      }
    }
  }

  return [...pendingMap.values()].sort((left, right) => right.pendingCount - left.pendingCount);
}

export async function getRejectionReport(auth: AuthContext): Promise<RejectionReportItem[]> {
  if (!auth.roles.includes("ADMIN") && !auth.roles.includes("MANAGER")) {
    throw new AppError(403, "REPORT_ACCESS_DENIED", "You do not have access to reporting");
  }

  const scopedEmployeeIds = await getScopedEmployeeIds(auth);
  const rejectedExpenses = await prisma.expense.findMany({
    where: {
      ...buildScopedWhere(auth.companyId, scopedEmployeeIds),
      status: ExpenseStatus.REJECTED
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      category: {
        select: {
          name: true
        }
      },
      approvalInstance: {
        include: {
          actions: {
            include: {
              actor: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            },
            where: {
              action: {
                in: ["REJECT", "OVERRIDE_REJECT"]
              }
            },
            orderBy: {
              actedAt: "desc"
            },
            take: 1
          }
        }
      }
    },
    orderBy: {
      submittedAt: "desc"
    },
    take: 20
  });

  return rejectedExpenses.map((expense) => {
    const rejectionAction = expense.approvalInstance?.actions[0] ?? null;

    return {
      expenseId: expense.id,
      employeeName: `${expense.employee.firstName} ${expense.employee.lastName}`.trim(),
      categoryName: expense.category.name,
      amountCompanyCurrency: expense.amountCompanyCurrency.toFixed(2),
      companyCurrency: expense.companyCurrency,
      rejectedAt: rejectionAction?.actedAt.toISOString() ?? null,
      rejectedBy: rejectionAction
        ? `${rejectionAction.actor.firstName} ${rejectionAction.actor.lastName}`.trim()
        : null,
      comment: rejectionAction?.comment ?? null
    };
  });
}

export async function getAgingReport(auth: AuthContext): Promise<AgingReportItem[]> {
  if (!auth.roles.includes("ADMIN") && !auth.roles.includes("MANAGER")) {
    throw new AppError(403, "REPORT_ACCESS_DENIED", "You do not have access to reporting");
  }

  const scopedEmployeeIds = await getScopedEmployeeIds(auth);
  const pendingExpenses = await prisma.expense.findMany({
    where: {
      ...buildScopedWhere(auth.companyId, scopedEmployeeIds),
      status: ExpenseStatus.IN_REVIEW,
      approvalInstance: {
        is: {
          status: "IN_PROGRESS"
        }
      }
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      category: {
        select: {
          name: true
        }
      },
      approvalInstance: {
        select: {
          currentStepOrder: true,
          workflowSnapshot: true
        }
      }
    },
    orderBy: {
      submittedAt: "asc"
    }
  });

  const now = Date.now();

  return pendingExpenses.map((expense) => {
    const snapshot = parseWorkflowSnapshot(expense.approvalInstance?.workflowSnapshot ?? null);
    const currentStage = snapshot.stages.find((stage) => stage.stepOrder === expense.approvalInstance?.currentStepOrder) ?? null;
    const submittedAt = expense.submittedAt ?? expense.createdAt;

    return {
      expenseId: expense.id,
      employeeName: `${expense.employee.firstName} ${expense.employee.lastName}`.trim(),
      categoryName: expense.category.name,
      amountCompanyCurrency: expense.amountCompanyCurrency.toFixed(2),
      companyCurrency: expense.companyCurrency,
      submittedAt: expense.submittedAt?.toISOString() ?? null,
      daysPending: Math.max(0, Math.floor((now - submittedAt.getTime()) / (1000 * 60 * 60 * 24))),
      currentStageName: currentStage?.name ?? null,
      pendingApprovers: currentStage?.approvers.map((approver) => approver.fullName) ?? []
    };
  });
}
