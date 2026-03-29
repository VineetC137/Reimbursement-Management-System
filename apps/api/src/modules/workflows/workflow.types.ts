export type WorkflowApproverSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type WorkflowStageSummary = {
  stepOrder: number;
  name: string;
  isRequired: boolean;
  approvers: WorkflowApproverSummary[];
};

export type WorkflowRuleSummary = {
  thresholdPercentage: number | null;
  specificApproverUserId: string | null;
};

export type WorkflowSettingsSummary = {
  id: string;
  name: string;
  description: string | null;
  managerFirst: boolean;
  isDefault: boolean;
  stages: WorkflowStageSummary[];
  ruleSummary: WorkflowRuleSummary;
};
