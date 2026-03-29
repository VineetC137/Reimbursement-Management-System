import { z } from "zod";

const workflowStepInputSchema = z.object({
  name: z.string().trim().min(2, "Step name should be at least 2 characters").max(80),
  approverIds: z.array(z.string().trim().min(1)).min(1, "Add at least one approver to each step"),
  isRequired: z.boolean().default(true)
});

export const updateWorkflowSchema = z.object({
  name: z.string().trim().min(3, "Workflow name should be at least 3 characters").max(120),
  description: z.string().trim().max(240).optional().nullable(),
  managerFirst: z.boolean(),
  thresholdPercentage: z
    .number({ invalid_type_error: "Threshold percentage must be a number" })
    .int("Threshold percentage should be a whole number")
    .min(1, "Threshold percentage should be at least 1")
    .max(100, "Threshold percentage cannot exceed 100")
    .optional()
    .nullable(),
  specificApproverUserId: z.string().trim().min(1).optional().nullable(),
  steps: z.array(workflowStepInputSchema).max(8, "Keep the workflow within 8 steps")
});

export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
