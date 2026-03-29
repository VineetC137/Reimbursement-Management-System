import { z } from "zod";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

const assignableRoleSchema = z.enum(["EMPLOYEE", "MANAGER"]);

export const createUserSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(60, "First name is too long"),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(60, "Last name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password is too long")
    .regex(passwordRule, "Password must contain uppercase, lowercase, and a number"),
  role: assignableRoleSchema
});

export const updateUserRoleSchema = z.object({
  role: assignableRoleSchema
});

export const assignManagerSchema = z.object({
  managerUserId: z.string().trim().min(1, "Select a manager")
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type AssignManagerInput = z.infer<typeof assignManagerSchema>;
