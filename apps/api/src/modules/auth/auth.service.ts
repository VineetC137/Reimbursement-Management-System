import { Prisma, PrismaClient, Role, UserStatus } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthContext, AuthSession } from "../../types/auth.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { createTokenPair } from "../../utils/tokens.js";
import { resolveCountryCurrency } from "../metadata/country-currency.service.js";
import type { LoginInput, SignupInput } from "./auth.schema.js";

const authUserInclude = {
  company: true,
  userRoles: {
    include: {
      role: true
    }
  }
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

const baseRoles: Array<Pick<Role, "name" | "description">> = [
  { name: "ADMIN", description: "Company administrator" },
  { name: "MANAGER", description: "Expense approver and team lead" },
  { name: "EMPLOYEE", description: "Expense submitter" }
];

const defaultCategories = [
  "Travel",
  "Food",
  "Accommodation",
  "Fuel",
  "Office Supplies",
  "Miscellaneous"
];

async function ensureBaseRoles(client: Prisma.TransactionClient | PrismaClient): Promise<Map<string, Role>> {
  for (const role of baseRoles) {
    await client.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role
    });
  }

  const roles = await client.role.findMany({
    where: {
      name: {
        in: baseRoles.map((role) => role.name)
      }
    }
  });

  return new Map(roles.map((role) => [role.name, role]));
}

async function createDefaultCategories(client: Prisma.TransactionClient, companyId: string): Promise<void> {
  await client.expenseCategory.createMany({
    data: defaultCategories.map((name) => ({
      companyId,
      name
    })),
    skipDuplicates: true
  });
}

function buildAuthContext(user: AuthUserRecord): AuthContext {
  return {
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
    roles: user.userRoles.map((userRole) => userRole.role.name)
  };
}

function buildSession(user: AuthUserRecord): AuthSession {
  const tokenPair = createTokenPair(buildAuthContext(user));

  return {
    ...tokenPair,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      roles: user.userRoles.map((userRole) => userRole.role.name)
    },
    company: {
      id: user.company.id,
      name: user.company.name,
      countryCode: user.company.countryCode,
      baseCurrency: user.company.baseCurrency
    }
  };
}

async function getUserById(userId: string): Promise<AuthUserRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: authUserInclude
  });

  if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
    throw new AppError(404, "USER_NOT_FOUND", "User account was not found");
  }

  return user;
}

export async function signupAdmin(input: SignupInput): Promise<AuthSession> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUsers = await prisma.user.findMany({
    where: {
      email: normalizedEmail,
      deletedAt: null
    },
    take: 2
  });

  if (existingUsers.length > 0) {
    throw new AppError(409, "EMAIL_ALREADY_USED", "This email address is already in use");
  }

  const selectedCountry = await resolveCountryCurrency(input.countryCode);
  const passwordHash = await hashPassword(input.password);

  const createdUser = await prisma.$transaction(async (client) => {
    const roleMap = await ensureBaseRoles(client);
    const adminRole = roleMap.get("ADMIN");

    if (!adminRole) {
      throw new AppError(500, "ROLE_SETUP_FAILED", "Admin role could not be prepared");
    }

    const company = await client.company.create({
      data: {
        name: input.companyName.trim(),
        countryCode: selectedCountry.countryCode,
        baseCurrency: selectedCountry.currencyCode
      }
    });

    const user = await client.user.create({
      data: {
        companyId: company.id,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail,
        passwordHash
      }
    });

    await client.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id
      }
    });

    await createDefaultCategories(client, company.id);

    return client.user.findUniqueOrThrow({
      where: { id: user.id },
      include: authUserInclude
    });
  });

  return buildSession(createdUser);
}

export async function loginUser(input: LoginInput): Promise<AuthSession> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      email: normalizedEmail,
      deletedAt: null
    },
    include: authUserInclude,
    take: 2
  });

  if (users.length === 0) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (users.length > 1) {
    throw new AppError(409, "AMBIGUOUS_LOGIN", "Multiple accounts were found for this email address");
  }

  const user = users[0];

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "This account is not active");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date()
    }
  });

  const refreshedUser = await getUserById(user.id);

  return buildSession(refreshedUser);
}

export async function getCurrentSession(userId: string): Promise<AuthSession> {
  const user = await getUserById(userId);
  return buildSession(user);
}
