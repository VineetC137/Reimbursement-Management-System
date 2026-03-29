import { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { UpdateWorkflowInput } from "./workflow.schema.js";
import type { WorkflowApproverSummary, WorkflowRuleSummary, WorkflowSettingsSummary, WorkflowStageSummary } from "./workflow.types.js";

const workflowInclude = {
  steps: {
    orderBy: {
      stepOrder: "asc"
    },
    include: {
      stepApprovers: {
        include: {
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    }
  },
  rules: {
    include: {
      conditions: true
    }
  }
} satisfies Prisma.ApprovalWorkflowInclude;

export type WorkflowRecord = Prisma.ApprovalWorkflowGetPayload<{
  include: typeof workflowInclude;
}>;

function mapApprover(approver: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}): WorkflowApproverSummary {
  return {
    id: approver.id,
    fullName: `${approver.firstName} ${approver.lastName}`.trim(),
    email: approver.email
  };
}

export function extractWorkflowRuleSummary(workflow: Pick<WorkflowRecord, "rules">): WorkflowRuleSummary {
  let thresholdPercentage: number | null = null;
  let specificApproverUserId: string | null = null;

  for (const rule of workflow.rules) {
    for (const condition of rule.conditions) {
      if (condition.field === "thresholdPercentage") {
        const parsedValue = Number(condition.value);

        if (!Number.isNaN(parsedValue)) {
          thresholdPercentage = parsedValue;
        }
      }

      if (condition.field === "specificApproverUserId") {
        specificApproverUserId = condition.value || null;
      }
    }
  }

  return {
    thresholdPercentage,
    specificApproverUserId
  };
}

export function buildWorkflowStages(workflow: Pick<WorkflowRecord, "steps">): WorkflowStageSummary[] {
  return workflow.steps
    .map((step) => ({
      stepOrder: step.stepOrder,
      name: step.name,
      isRequired: step.isRequired,
      approvers: step.stepApprovers.map((stepApprover) => mapApprover(stepApprover.approver))
    }))
    .filter((stage) => stage.approvers.length > 0);
}

function mapWorkflowSettings(workflow: WorkflowRecord): WorkflowSettingsSummary {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    managerFirst: workflow.managerFirst,
    isDefault: workflow.isDefault,
    stages: buildWorkflowStages(workflow),
    ruleSummary: extractWorkflowRuleSummary(workflow)
  };
}

export async function ensureDefaultWorkflow(
  companyId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma
): Promise<WorkflowRecord> {
  const existingWorkflow = await client.approvalWorkflow.findFirst({
    where: {
      companyId,
      isDefault: true,
      deletedAt: null
    },
    include: workflowInclude
  });

  if (existingWorkflow) {
    return existingWorkflow;
  }

  const createdWorkflow = await client.approvalWorkflow.create({
    data: {
      companyId,
      name: "Default Approval Workflow",
      description: "Primary approval configuration for submitted expenses",
      isDefault: true,
      isActive: true,
      managerFirst: true
    },
    include: workflowInclude
  });

  return createdWorkflow;
}

async function loadApproverDirectory(companyId: string): Promise<
  Map<
    string,
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      roles: string[];
    }
  >
> {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "ACTIVE"
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  return new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.userRoles.map((userRole) => userRole.role.name)
      }
    ])
  );
}

function validateApproverUser(
  approverDirectory: Map<
    string,
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      roles: string[];
    }
  >,
  userId: string
): void {
  const user = approverDirectory.get(userId);

  if (!user) {
    throw new AppError(400, "INVALID_APPROVER", "One or more approvers do not belong to the company");
  }

  if (!user.roles.includes("MANAGER") && !user.roles.includes("ADMIN")) {
    throw new AppError(400, "INVALID_APPROVER_ROLE", "Approvers should have manager or admin access");
  }
}

export async function getWorkflowSettings(companyId: string): Promise<WorkflowSettingsSummary> {
  const workflow = await ensureDefaultWorkflow(companyId);
  return mapWorkflowSettings(workflow);
}

export async function getWorkflowRecord(companyId: string): Promise<WorkflowRecord> {
  return ensureDefaultWorkflow(companyId);
}

export async function updateWorkflowSettings(
  companyId: string,
  actorUserId: string,
  input: UpdateWorkflowInput
): Promise<WorkflowSettingsSummary> {
  const approverDirectory = await loadApproverDirectory(companyId);
  const flattenedApproverIds = new Set<string>();

  input.steps.forEach((step, index) => {
    step.approverIds.forEach((approverId) => {
      validateApproverUser(approverDirectory, approverId);

      if (flattenedApproverIds.has(approverId)) {
        throw new AppError(
          400,
          "DUPLICATE_APPROVER",
          `Approver assignments should be unique across the workflow. Remove duplicates near step ${index + 1}.`
        );
      }

      flattenedApproverIds.add(approverId);
    });
  });

  if (input.specificApproverUserId) {
    validateApproverUser(approverDirectory, input.specificApproverUserId);

    if (!flattenedApproverIds.has(input.specificApproverUserId)) {
      throw new AppError(
        400,
        "SPECIFIC_APPROVER_NOT_IN_WORKFLOW",
        "Specific approver should also be present in one of the workflow steps"
      );
    }
  }

  const updatedWorkflow = await prisma.$transaction(async (client) => {
    const workflow = await ensureDefaultWorkflow(companyId, client);

    await client.workflowStepApprover.deleteMany({
      where: {
        step: {
          workflowId: workflow.id
        }
      }
    });

    await client.workflowStep.deleteMany({
      where: {
        workflowId: workflow.id
      }
    });

    await client.approvalRuleCondition.deleteMany({
      where: {
        rule: {
          workflowId: workflow.id
        }
      }
    });

    await client.approvalRule.deleteMany({
      where: {
        workflowId: workflow.id
      }
    });

    await client.approvalWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        managerFirst: input.managerFirst
      }
    });

    for (const [index, step] of input.steps.entries()) {
      const createdStep = await client.workflowStep.create({
        data: {
          workflowId: workflow.id,
          stepOrder: index + 1,
          name: step.name.trim(),
          isRequired: step.isRequired
        }
      });

      const uniqueApproverIds = [...new Set(step.approverIds)];

      await client.workflowStepApprover.createMany({
        data: uniqueApproverIds.map((approverId) => ({
          stepId: createdStep.id,
          approverId
        })),
        skipDuplicates: true
      });
    }

    if (input.thresholdPercentage) {
      const percentageRule = await client.approvalRule.create({
        data: {
          workflowId: workflow.id,
          ruleType: input.specificApproverUserId ? "HYBRID" : "PERCENTAGE"
        }
      });

      await client.approvalRuleCondition.create({
        data: {
          ruleId: percentageRule.id,
          field: "thresholdPercentage",
          operator: "GTE",
          value: String(input.thresholdPercentage)
        }
      });
    }

    if (input.specificApproverUserId) {
      const specificApproverRule = await client.approvalRule.create({
        data: {
          workflowId: workflow.id,
          ruleType: input.thresholdPercentage ? "HYBRID" : "SPECIFIC_APPROVER"
        }
      });

      await client.approvalRuleCondition.create({
        data: {
          ruleId: specificApproverRule.id,
          field: "specificApproverUserId",
          operator: "EQ",
          value: input.specificApproverUserId
        }
      });
    }

    await client.auditLog.create({
      data: {
        companyId,
        userId: actorUserId,
        entityType: "WORKFLOW",
        entityId: workflow.id,
        action: "UPDATE_APPROVAL_WORKFLOW",
        newValue: {
          managerFirst: input.managerFirst,
          thresholdPercentage: input.thresholdPercentage ?? null,
          specificApproverUserId: input.specificApproverUserId ?? null,
          stepCount: input.steps.length
        }
      }
    });

    return client.approvalWorkflow.findUniqueOrThrow({
      where: {
        id: workflow.id
      },
      include: workflowInclude
    });
  });

  return mapWorkflowSettings(updatedWorkflow);
}
