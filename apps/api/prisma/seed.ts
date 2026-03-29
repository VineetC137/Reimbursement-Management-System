import {
  ApprovalActionType,
  ApprovalInstanceStatus,
  ExpenseStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";

import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

const demoCompanyName = "Demo Reimburse Labs";
const baseCurrency = "INR";
const roleNames = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;
const categoryNames = ["Travel", "Food", "Accommodation", "Fuel", "Office Supplies", "Miscellaneous"] as const;

async function ensureRoles() {
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: { description: `${name} role` },
      create: { name, description: `${name} role` }
    });
  }

  const roles = await prisma.role.findMany({
    where: {
      name: {
        in: [...roleNames]
      }
    }
  });

  return new Map(roles.map((role) => [role.name, role.id]));
}

async function ensureDemoCompany() {
  const existingCompany = await prisma.company.findFirst({
    where: {
      name: demoCompanyName,
      deletedAt: null
    }
  });

  if (existingCompany) {
    return existingCompany;
  }

  return prisma.company.create({
    data: {
      name: demoCompanyName,
      countryCode: "IN",
      baseCurrency
    }
  });
}

async function ensureUser(
  companyId: string,
  roleId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }
) {
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId,
        email: input.email
      }
    },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      status: "ACTIVE"
    },
    create: {
      companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId
    }
  });

  return user;
}

async function ensureCategories(companyId: string) {
  await prisma.expenseCategory.createMany({
    data: categoryNames.map((name) => ({
      companyId,
      name
    })),
    skipDuplicates: true
  });

  const categories = await prisma.expenseCategory.findMany({
    where: {
      companyId,
      deletedAt: null
    }
  });

  return new Map(categories.map((category) => [category.name, category.id]));
}

async function resetDemoDynamicData(companyId: string) {
  const workflows = await prisma.approvalWorkflow.findMany({
    where: { companyId },
    select: { id: true }
  });

  const workflowIds = workflows.map((workflow) => workflow.id);
  const steps = workflowIds.length
    ? await prisma.workflowStep.findMany({
        where: {
          workflowId: {
            in: workflowIds
          }
        },
        select: { id: true }
      })
    : [];
  const stepIds = steps.map((step) => step.id);
  const rules = workflowIds.length
    ? await prisma.approvalRule.findMany({
        where: {
          workflowId: {
            in: workflowIds
          }
        },
        select: { id: true }
      })
    : [];
  const ruleIds = rules.map((rule) => rule.id);
  const expenseInstances = await prisma.expenseApprovalInstance.findMany({
    where: {
      expense: {
        companyId
      }
    },
    select: { id: true }
  });
  const instanceIds = expenseInstances.map((instance) => instance.id);
  const expenses = await prisma.expense.findMany({
    where: { companyId },
    select: { id: true }
  });
  const expenseIds = expenses.map((expense) => expense.id);

  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  if (instanceIds.length > 0) {
    await prisma.expenseApprovalAction.deleteMany({
      where: {
        instanceId: {
          in: instanceIds
        }
      }
    });
  }
  await prisma.expenseApprovalInstance.deleteMany({
    where: {
      expense: {
        companyId
      }
    }
  });
  if (stepIds.length > 0) {
    await prisma.workflowStepApprover.deleteMany({
      where: {
        stepId: {
          in: stepIds
        }
      }
    });
  }
  if (ruleIds.length > 0) {
    await prisma.approvalRuleCondition.deleteMany({
      where: {
        ruleId: {
          in: ruleIds
        }
      }
    });
  }
  await prisma.approvalRule.deleteMany({ where: { workflowId: { in: workflowIds } } });
  await prisma.workflowStep.deleteMany({ where: { workflowId: { in: workflowIds } } });
  await prisma.approvalWorkflow.deleteMany({ where: { companyId } });
  if (expenseIds.length > 0) {
    await prisma.expenseReceipt.deleteMany({
      where: {
        expenseId: {
          in: expenseIds
        }
      }
    });
  }
  await prisma.expense.deleteMany({ where: { companyId } });
  await prisma.managerMapping.deleteMany({ where: { companyId } });
  await prisma.currencyRate.deleteMany({ where: { companyId } });
}

function buildWorkflowSnapshot(data: {
  workflowId: string;
  manager: { id: string; fullName: string; email: string };
  finance: { id: string; fullName: string; email: string };
  admin: { id: string; fullName: string; email: string };
}) {
  return {
    workflowId: data.workflowId,
    workflowName: "Default Approval Workflow",
    managerFirst: true,
    thresholdPercentage: 60,
    specificApproverUserId: data.admin.id,
    stages: [
      {
        stepOrder: 0,
        name: "Reporting Manager Review",
        isRequired: true,
        approvers: [data.manager]
      },
      {
        stepOrder: 1,
        name: "Finance Review",
        isRequired: true,
        approvers: [data.finance]
      },
      {
        stepOrder: 2,
        name: "Director Review",
        isRequired: true,
        approvers: [data.admin]
      }
    ]
  };
}

async function main(): Promise<void> {
  const roleMap = await ensureRoles();
  const company = await ensureDemoCompany();
  await resetDemoDynamicData(company.id);

  const admin = await ensureUser(company.id, roleMap.get("ADMIN")!, {
    firstName: "Vineet",
    lastName: "Admin",
    email: "admin@demo-reimburse.local",
    password: "Admin@123"
  });
  const manager = await ensureUser(company.id, roleMap.get("MANAGER")!, {
    firstName: "Sarah",
    lastName: "Manager",
    email: "sarah.manager@demo-reimburse.local",
    password: "Manager@123"
  });
  const finance = await ensureUser(company.id, roleMap.get("MANAGER")!, {
    firstName: "Aarav",
    lastName: "Finance",
    email: "aarav.finance@demo-reimburse.local",
    password: "Finance@123"
  });
  const employeeOne = await ensureUser(company.id, roleMap.get("EMPLOYEE")!, {
    firstName: "Neha",
    lastName: "Patil",
    email: "neha.patil@demo-reimburse.local",
    password: "Employee@123"
  });
  const employeeTwo = await ensureUser(company.id, roleMap.get("EMPLOYEE")!, {
    firstName: "Rohan",
    lastName: "Shah",
    email: "rohan.shah@demo-reimburse.local",
    password: "Employee@123"
  });

  await prisma.managerMapping.createMany({
    data: [
      {
        companyId: company.id,
        employeeId: employeeOne.id,
        managerId: manager.id
      },
      {
        companyId: company.id,
        employeeId: employeeTwo.id,
        managerId: manager.id
      }
    ]
  });

  const categoryMap = await ensureCategories(company.id);

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      companyId: company.id,
      name: "Default Approval Workflow",
      description: "Seeded workflow for demo and presentation readiness",
      isDefault: true,
      isActive: true,
      managerFirst: true
    }
  });

  const financeStep = await prisma.workflowStep.create({
    data: {
      workflowId: workflow.id,
      stepOrder: 1,
      name: "Finance Review",
      isRequired: true
    }
  });

  const directorStep = await prisma.workflowStep.create({
    data: {
      workflowId: workflow.id,
      stepOrder: 2,
      name: "Director Review",
      isRequired: true
    }
  });

  await prisma.workflowStepApprover.createMany({
    data: [
      { stepId: financeStep.id, approverId: finance.id },
      { stepId: directorStep.id, approverId: admin.id }
    ]
  });

  const percentageRule = await prisma.approvalRule.create({
    data: {
      workflowId: workflow.id,
      ruleType: "HYBRID"
    }
  });

  await prisma.approvalRuleCondition.createMany({
    data: [
      {
        ruleId: percentageRule.id,
        field: "thresholdPercentage",
        operator: "GTE",
        value: "60"
      },
      {
        ruleId: percentageRule.id,
        field: "specificApproverUserId",
        operator: "EQ",
        value: admin.id
      }
    ]
  });

  await prisma.countryCurrencyCache.upsert({
    where: {
      countryCode: "IN"
    },
    update: {
      countryName: "India",
      currencyCode: "INR",
      currencyName: "Indian Rupee",
      currencySymbol: "₹",
      lastSyncedAt: new Date()
    },
    create: {
      countryCode: "IN",
      countryName: "India",
      currencyCode: "INR",
      currencyName: "Indian Rupee",
      currencySymbol: "₹"
    }
  });

  await prisma.currencyRate.createMany({
    data: [
      {
        companyId: company.id,
        baseCurrency: "USD",
        quoteCurrency: "INR",
        rate: new Prisma.Decimal("83.150000"),
        source: "seed",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
      },
      {
        companyId: company.id,
        baseCurrency: "EUR",
        quoteCurrency: "INR",
        rate: new Prisma.Decimal("90.250000"),
        source: "seed",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
      }
    ]
  });

  const snapshot = buildWorkflowSnapshot({
    workflowId: workflow.id,
    manager: {
      id: manager.id,
      fullName: `${manager.firstName} ${manager.lastName}`,
      email: manager.email
    },
    finance: {
      id: finance.id,
      fullName: `${finance.firstName} ${finance.lastName}`,
      email: finance.email
    },
    admin: {
      id: admin.id,
      fullName: `${admin.firstName} ${admin.lastName}`,
      email: admin.email
    }
  });

  const draftExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeId: employeeOne.id,
      categoryId: categoryMap.get("Travel")!,
      amountOriginal: new Prisma.Decimal("122.40"),
      originalCurrency: "USD",
      amountCompanyCurrency: new Prisma.Decimal("10181.56"),
      companyCurrency: baseCurrency,
      exchangeRate: new Prisma.Decimal("83.150000"),
      expenseDate: new Date("2026-03-24T00:00:00.000Z"),
      description: "Airport taxi and interstate cab transfer",
      duplicateFingerprint: `${employeeOne.id}|${categoryMap.get("Travel")}|USD|122.40|2026-03-24|airport taxi and interstate cab transfer`,
      status: ExpenseStatus.DRAFT
    }
  });

  const inReviewExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeId: employeeTwo.id,
      categoryId: categoryMap.get("Food")!,
      amountOriginal: new Prisma.Decimal("1850.00"),
      originalCurrency: "INR",
      amountCompanyCurrency: new Prisma.Decimal("1850.00"),
      companyCurrency: baseCurrency,
      exchangeRate: new Prisma.Decimal("1.000000"),
      expenseDate: new Date("2026-03-22T00:00:00.000Z"),
      description: "Client lunch at downtown restaurant",
      duplicateFingerprint: `${employeeTwo.id}|${categoryMap.get("Food")}|INR|1850.00|2026-03-22|client lunch at downtown restaurant`,
      status: ExpenseStatus.IN_REVIEW,
      submittedAt: new Date("2026-03-23T09:30:00.000Z")
    }
  });

  const approvedExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeId: employeeOne.id,
      categoryId: categoryMap.get("Accommodation")!,
      amountOriginal: new Prisma.Decimal("90.00"),
      originalCurrency: "EUR",
      amountCompanyCurrency: new Prisma.Decimal("8122.50"),
      companyCurrency: baseCurrency,
      exchangeRate: new Prisma.Decimal("90.250000"),
      expenseDate: new Date("2026-03-18T00:00:00.000Z"),
      description: "Client site overnight hotel stay",
      duplicateFingerprint: `${employeeOne.id}|${categoryMap.get("Accommodation")}|EUR|90.00|2026-03-18|client site overnight hotel stay`,
      status: ExpenseStatus.APPROVED,
      submittedAt: new Date("2026-03-18T11:00:00.000Z")
    }
  });

  const rejectedExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeId: employeeTwo.id,
      categoryId: categoryMap.get("Office Supplies")!,
      amountOriginal: new Prisma.Decimal("950.00"),
      originalCurrency: "INR",
      amountCompanyCurrency: new Prisma.Decimal("950.00"),
      companyCurrency: baseCurrency,
      exchangeRate: new Prisma.Decimal("1.000000"),
      expenseDate: new Date("2026-03-16T00:00:00.000Z"),
      description: "Printer cartridges purchased without approval note",
      duplicateFingerprint: `${employeeTwo.id}|${categoryMap.get("Office Supplies")}|INR|950.00|2026-03-16|printer cartridges purchased without approval note`,
      status: ExpenseStatus.REJECTED,
      submittedAt: new Date("2026-03-16T12:30:00.000Z")
    }
  });

  const inReviewInstance = await prisma.expenseApprovalInstance.create({
    data: {
      expenseId: inReviewExpense.id,
      workflowId: workflow.id,
      currentStepOrder: 1,
      status: ApprovalInstanceStatus.IN_PROGRESS,
      workflowSnapshot: snapshot
    }
  });

  const approvedInstance = await prisma.expenseApprovalInstance.create({
    data: {
      expenseId: approvedExpense.id,
      workflowId: workflow.id,
      currentStepOrder: 2,
      status: ApprovalInstanceStatus.APPROVED,
      workflowSnapshot: snapshot,
      completedAt: new Date("2026-03-19T14:00:00.000Z")
    }
  });

  const rejectedInstance = await prisma.expenseApprovalInstance.create({
    data: {
      expenseId: rejectedExpense.id,
      workflowId: workflow.id,
      currentStepOrder: 1,
      status: ApprovalInstanceStatus.REJECTED,
      workflowSnapshot: snapshot,
      completedAt: new Date("2026-03-17T16:00:00.000Z")
    }
  });

  await prisma.expenseApprovalAction.createMany({
    data: [
      {
        instanceId: inReviewInstance.id,
        stepOrder: 0,
        actorId: manager.id,
        action: ApprovalActionType.APPROVE,
        comment: "Looks fine from manager side.",
        fromStatus: ExpenseStatus.IN_REVIEW,
        toStatus: ExpenseStatus.IN_REVIEW,
        actedAt: new Date("2026-03-23T10:15:00.000Z")
      },
      {
        instanceId: approvedInstance.id,
        stepOrder: 0,
        actorId: manager.id,
        action: ApprovalActionType.APPROVE,
        comment: "Travel stay matched the visit plan.",
        fromStatus: ExpenseStatus.IN_REVIEW,
        toStatus: ExpenseStatus.IN_REVIEW,
        actedAt: new Date("2026-03-18T12:00:00.000Z")
      },
      {
        instanceId: approvedInstance.id,
        stepOrder: 1,
        actorId: finance.id,
        action: ApprovalActionType.APPROVE,
        comment: "Finance checked the hotel invoice.",
        fromStatus: ExpenseStatus.IN_REVIEW,
        toStatus: ExpenseStatus.IN_REVIEW,
        actedAt: new Date("2026-03-19T10:30:00.000Z")
      },
      {
        instanceId: approvedInstance.id,
        stepOrder: 2,
        actorId: admin.id,
        action: ApprovalActionType.APPROVE,
        comment: "Approved after final review.",
        fromStatus: ExpenseStatus.IN_REVIEW,
        toStatus: ExpenseStatus.APPROVED,
        actedAt: new Date("2026-03-19T13:45:00.000Z")
      },
      {
        instanceId: rejectedInstance.id,
        stepOrder: 0,
        actorId: manager.id,
        action: ApprovalActionType.APPROVE,
        comment: "Checked line items and forwarded.",
        fromStatus: ExpenseStatus.IN_REVIEW,
        toStatus: ExpenseStatus.IN_REVIEW,
        actedAt: new Date("2026-03-16T14:00:00.000Z")
      },
      {
        instanceId: rejectedInstance.id,
        stepOrder: 1,
        actorId: finance.id,
        action: ApprovalActionType.REJECT,
        comment: "Receipt was incomplete and missing purchase approval context.",
        fromStatus: ExpenseStatus.IN_REVIEW,
        toStatus: ExpenseStatus.REJECTED,
        actedAt: new Date("2026-03-17T15:50:00.000Z")
      }
    ]
  });

  await prisma.notification.createMany({
    data: [
      {
        companyId: company.id,
        userId: finance.id,
        title: "Expense waiting for your action",
        message: "Rohan Shah submitted a food reimbursement that has reached finance review.",
        payload: { expenseId: inReviewExpense.id, currentStepOrder: 1 },
        status: "PENDING"
      },
      {
        companyId: company.id,
        userId: employeeOne.id,
        title: "Expense approved",
        message: "Your accommodation claim was approved after director review.",
        payload: { expenseId: approvedExpense.id },
        status: "READ",
        readAt: new Date("2026-03-19T16:00:00.000Z")
      },
      {
        companyId: company.id,
        userId: employeeTwo.id,
        title: "Expense rejected",
        message: "Your office supplies claim was rejected by finance with comments.",
        payload: { expenseId: rejectedExpense.id },
        status: "PENDING"
      }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: company.id,
        userId: employeeOne.id,
        expenseId: draftExpense.id,
        entityType: "EXPENSE",
        entityId: draftExpense.id,
        action: "CREATE_EXPENSE_DRAFT"
      },
      {
        companyId: company.id,
        userId: employeeTwo.id,
        expenseId: inReviewExpense.id,
        entityType: "EXPENSE",
        entityId: inReviewExpense.id,
        action: "SUBMIT_EXPENSE"
      },
      {
        companyId: company.id,
        userId: admin.id,
        entityType: "WORKFLOW",
        entityId: workflow.id,
        action: "UPDATE_APPROVAL_WORKFLOW"
      }
    ]
  });

  console.log("Seed completed");
  console.log("Demo admin login: admin@demo-reimburse.local / Admin@123");
  console.log("Demo manager login: sarah.manager@demo-reimburse.local / Manager@123");
  console.log("Demo finance login: aarav.finance@demo-reimburse.local / Finance@123");
  console.log("Demo employee login: neha.patil@demo-reimburse.local / Employee@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
