import { Prisma, Role, UserStatus } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../utils/password.js";
import type { AssignManagerInput, CreateUserInput, UpdateUserRoleInput } from "./user.schema.js";
import type { UserSummary } from "./user.types.js";

const userSummaryInclude = {
  userRoles: {
    include: {
      role: true
    }
  },
  managerMappings: {
    where: {
      endedAt: null
    },
    orderBy: {
      effectiveAt: "desc"
    },
    take: 1,
    include: {
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof userSummaryInclude;
}>;

const assignableRoles = ["EMPLOYEE", "MANAGER"] as const;

function mapUserSummary(user: UserWithRelations): UserSummary {
  const activeManagerMapping = user.managerMappings[0];
  const primaryRole = user.userRoles.find((userRole) => userRole.role.name !== "ADMIN") ?? user.userRoles[0];

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: primaryRole?.role.name ?? "EMPLOYEE",
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    manager: activeManagerMapping
      ? {
          id: activeManagerMapping.manager.id,
          fullName: `${activeManagerMapping.manager.firstName} ${activeManagerMapping.manager.lastName}`.trim(),
          email: activeManagerMapping.manager.email
        }
      : null
  };
}

async function findRoleByName(roleName: (typeof assignableRoles)[number]): Promise<Role> {
  const role = await prisma.role.findUnique({
    where: {
      name: roleName
    }
  });

  if (!role) {
    throw new AppError(500, "ROLE_NOT_FOUND", `Role ${roleName} is not configured`);
  }

  return role;
}

async function getUserForCompany(userId: string, companyId: string): Promise<UserWithRelations> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
      deletedAt: null
    },
    include: userSummaryInclude
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  }

  return user;
}

async function writeAuditLog(input: {
  companyId: string;
  actorUserId: string;
  entityId: string;
  action: string;
  oldValue?: Prisma.JsonObject;
  newValue?: Prisma.JsonObject;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.actorUserId,
      entityType: "USER",
      entityId: input.entityId,
      action: input.action,
      oldValue: input.oldValue,
      newValue: input.newValue
    }
  });
}

export async function listCompanyUsers(companyId: string): Promise<UserSummary[]> {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      deletedAt: null
    },
    include: userSummaryInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return users.map(mapUserSummary);
}

export async function createCompanyUser(
  companyId: string,
  actorUserId: string,
  input: CreateUserInput
): Promise<UserSummary> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = await prisma.user.findFirst({
    where: {
      companyId,
      email: normalizedEmail,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    throw new AppError(409, "EMAIL_ALREADY_USED", "This email address already exists in the company");
  }

  const role = await findRoleByName(input.role);
  const passwordHash = await hashPassword(input.password);

  const createdUser = await prisma.$transaction(async (client) => {
    const user = await client.user.create({
      data: {
        companyId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail,
        passwordHash,
        status: UserStatus.ACTIVE
      }
    });

    await client.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        assignedBy: actorUserId
      }
    });

    await client.auditLog.create({
      data: {
        companyId,
        userId: actorUserId,
        entityType: "USER",
        entityId: user.id,
        action: "CREATE_USER",
        newValue: {
          email: user.email,
          role: input.role
        }
      }
    });

    return client.user.findUniqueOrThrow({
      where: {
        id: user.id
      },
      include: userSummaryInclude
    });
  });

  return mapUserSummary(createdUser);
}

export async function updateCompanyUserRole(
  companyId: string,
  actorUserId: string,
  userId: string,
  input: UpdateUserRoleInput
): Promise<UserSummary> {
  if (actorUserId === userId) {
    throw new AppError(409, "SELF_ROLE_CHANGE_BLOCKED", "You cannot change your own role from this screen");
  }

  const targetUser = await getUserForCompany(userId, companyId);
  const roleNames = targetUser.userRoles.map((userRole) => userRole.role.name);

  if (roleNames.includes("ADMIN")) {
    throw new AppError(409, "ADMIN_ROLE_PROTECTED", "Admin role cannot be changed here");
  }

  const currentRole = roleNames.find((roleName) => assignableRoles.includes(roleName as (typeof assignableRoles)[number]));

  if (currentRole === input.role) {
    return mapUserSummary(targetUser);
  }

  if (input.role === "EMPLOYEE") {
    const activeReportsCount = await prisma.managerMapping.count({
      where: {
        companyId,
        managerId: userId,
        endedAt: null
      }
    });

    if (activeReportsCount > 0) {
      throw new AppError(
        409,
        "ROLE_CHANGE_BLOCKED",
        "This manager still has active reportees. Reassign them before changing the role."
      );
    }
  }

  const newRole = await findRoleByName(input.role);

  const updatedUser = await prisma.$transaction(async (client) => {
    await client.userRole.deleteMany({
      where: {
        userId,
        role: {
          name: {
            in: assignableRoles as unknown as string[]
          }
        }
      }
    });

    await client.userRole.create({
      data: {
        userId,
        roleId: newRole.id,
        assignedBy: actorUserId
      }
    });

    await client.auditLog.create({
      data: {
        companyId,
        userId: actorUserId,
        entityType: "USER",
        entityId: userId,
        action: "UPDATE_ROLE",
        oldValue: { role: currentRole ?? null },
        newValue: { role: input.role }
      }
    });

    return client.user.findUniqueOrThrow({
      where: {
        id: userId
      },
      include: userSummaryInclude
    });
  });

  return mapUserSummary(updatedUser);
}

export async function assignCompanyManager(
  companyId: string,
  actorUserId: string,
  employeeUserId: string,
  input: AssignManagerInput
): Promise<UserSummary> {
  if (employeeUserId === input.managerUserId) {
    throw new AppError(400, "INVALID_MANAGER_MAPPING", "A user cannot be assigned as their own manager");
  }

  const employee = await getUserForCompany(employeeUserId, companyId);
  const manager = await getUserForCompany(input.managerUserId, companyId);

  const employeeRoles = employee.userRoles.map((userRole) => userRole.role.name);
  const managerRoles = manager.userRoles.map((userRole) => userRole.role.name);

  if (employeeRoles.includes("ADMIN")) {
    throw new AppError(409, "INVALID_MANAGER_MAPPING", "Admin users cannot be assigned a reporting manager here");
  }

  if (!managerRoles.includes("MANAGER")) {
    throw new AppError(400, "INVALID_MANAGER_ROLE", "Selected user does not have the manager role");
  }

  const activeMapping = employee.managerMappings[0] ?? null;

  if (activeMapping?.manager.id === manager.id) {
    return mapUserSummary(employee);
  }

  const updatedUser = await prisma.$transaction(async (client) => {
    if (activeMapping) {
      await client.managerMapping.update({
        where: {
          id: activeMapping.id
        },
        data: {
          endedAt: new Date()
        }
      });
    }

    await client.managerMapping.create({
      data: {
        companyId,
        employeeId: employee.id,
        managerId: manager.id
      }
    });

    await client.auditLog.create({
      data: {
        companyId,
        userId: actorUserId,
        entityType: "USER",
        entityId: employee.id,
        action: "ASSIGN_MANAGER",
        oldValue: activeMapping
          ? {
              managerUserId: activeMapping.manager.id,
              managerEmail: activeMapping.manager.email
            }
          : undefined,
        newValue: {
          managerUserId: manager.id,
          managerEmail: manager.email
        }
      }
    });

    return client.user.findUniqueOrThrow({
      where: {
        id: employee.id
      },
      include: userSummaryInclude
    });
  });

  return mapUserSummary(updatedUser);
}
