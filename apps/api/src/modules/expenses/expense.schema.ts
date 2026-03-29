import { z } from "zod";

export const createExpenseSchema = z.object({
  categoryId: z.string().trim().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount should be greater than zero"),
  currencyCode: z
    .string()
    .trim()
    .min(3, "Currency is required")
    .max(3, "Currency should use a 3-letter code")
    .transform((value) => value.toUpperCase()),
  expenseDate: z.string().trim().min(1, "Expense date is required"),
  description: z.string().trim().min(3, "Description should be at least 3 characters").max(240),
  receiptUrl: z.string().trim().url("Receipt link should be a valid URL").optional().nullable()
});

export const updateExpenseSchema = createExpenseSchema;

export const approvalActionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().trim().max(240).optional().nullable()
});

export const overrideExpenseSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().trim().min(3, "Override reason should be at least 3 characters").max(240)
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
export type OverrideExpenseInput = z.infer<typeof overrideExpenseSchema>;
