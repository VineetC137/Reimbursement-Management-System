import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import "./styles/tokens.css";
import "./styles/app.css";
import { validateExpenseDraft } from "./utils/expense-form";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
const SESSION_STORAGE_KEY = "reimbursement-session";

type AuthMode = "signup" | "login";
type AssignableRole = "EMPLOYEE" | "MANAGER";

type CountryOption = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string | null;
  currencySymbol: string | null;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    roles: string[];
  };
  company: {
    id: string;
    name: string;
    countryCode: string;
    baseCurrency: string;
  };
};

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  manager: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

type ExpenseCategorySummary = {
  id: string;
  name: string;
  description: string | null;
};

type ExpenseActorSummary = {
  id: string;
  fullName: string;
  email: string;
};

type ExpenseApprovalActionSummary = {
  id: string;
  actor: ExpenseActorSummary;
  action: string;
  comment: string | null;
  stepOrder: number;
  actedAt: string;
};

type ExpenseSummary = {
  id: string;
  status: string;
  amountOriginal: string;
  originalCurrency: string;
  amountCompanyCurrency: string;
  companyCurrency: string;
  exchangeRate: string;
  expenseDate: string;
  description: string | null;
  submittedAt: string | null;
  createdAt: string;
  category: ExpenseCategorySummary;
  employee: ExpenseActorSummary;
  receipt: {
    id: string;
    sourceType: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    ocrStatus: string;
    ocrErrorMessage: string | null;
    extractedAmount: string | null;
    extractedCurrency: string | null;
    extractedDate: string | null;
    extractedMerchantName: string | null;
    suggestedDescription: string | null;
    suggestedCategoryName: string | null;
    ocrConfidence: string | null;
  } | null;
  approval: {
    instanceId: string | null;
    status: string | null;
    currentStepOrder: number | null;
    currentStageName: string | null;
    pendingApprovers: ExpenseActorSummary[];
    thresholdPercentage: number | null;
    specificApproverUserId: string | null;
    actions: ExpenseApprovalActionSummary[];
  };
};

type WorkflowStageSummary = {
  stepOrder: number;
  name: string;
  isRequired: boolean;
  approvers: ExpenseActorSummary[];
};

type WorkflowSettingsSummary = {
  id: string;
  name: string;
  description: string | null;
  managerFirst: boolean;
  isDefault: boolean;
  stages: WorkflowStageSummary[];
  ruleSummary: {
    thresholdPercentage: number | null;
    specificApproverUserId: string | null;
  };
};

type NotificationSummary = {
  id: string;
  title: string;
  message: string;
  status: string;
  channel: string;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
};

type ReportDashboardSummary = {
  totalExpenses: number;
  draftExpenses: number;
  inReviewExpenses: number;
  approvedExpenses: number;
  rejectedExpenses: number;
  approvedAmountCompanyCurrency: string;
  inReviewAmountCompanyCurrency: string;
};

type PendingByApproverItem = {
  approverId: string;
  approverName: string;
  approverEmail: string;
  pendingCount: number;
};

type RejectionReportItem = {
  expenseId: string;
  employeeName: string;
  categoryName: string;
  amountCompanyCurrency: string;
  companyCurrency: string;
  rejectedAt: string | null;
  rejectedBy: string | null;
  comment: string | null;
};

type AgingReportItem = {
  expenseId: string;
  employeeName: string;
  categoryName: string;
  amountCompanyCurrency: string;
  companyCurrency: string;
  submittedAt: string | null;
  daysPending: number;
  currentStageName: string | null;
  pendingApprovers: string[];
};

type ReceiptUploadResult = {
  expense: ExpenseSummary;
  extraction: {
    rawText: string | null;
    confidence: string | null;
    amount: string | null;
    currency: string | null;
    expenseDate: string | null;
    merchantName: string | null;
    suggestedDescription: string | null;
    suggestedCategoryName: string | null;
    status: string;
    errorMessage: string | null;
  };
};

type ApiErrorPayload = {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, string>;
  };
  message?: string;
};

type ApiSuccessPayload<T> = {
  success: true;
  message?: string;
  data: T;
};

type SignupFormState = {
  companyName: string;
  countryCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type LoginFormState = {
  email: string;
  password: string;
};

type CreateUserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: AssignableRole;
};

type ExpenseFormState = {
  categoryId: string;
  amount: string;
  currencyCode: string;
  expenseDate: string;
  description: string;
  receiptUrl: string;
};

type WorkflowStepFormState = {
  name: string;
  approverIds: string[];
  isRequired: boolean;
};

type WorkflowFormState = {
  name: string;
  description: string;
  managerFirst: boolean;
  thresholdPercentage: string;
  specificApproverUserId: string;
  steps: WorkflowStepFormState[];
};

type RequestJsonOptions = RequestInit & {
  token?: string;
  headers?: HeadersInit;
};

const initialSignupForm: SignupFormState = {
  companyName: "",
  countryCode: "",
  firstName: "",
  lastName: "",
  email: "",
  password: ""
};

const initialLoginForm: LoginFormState = {
  email: "",
  password: ""
};

const initialCreateUserForm: CreateUserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "EMPLOYEE"
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyExpenseForm(baseCurrency = ""): ExpenseFormState {
  return {
    categoryId: "",
    amount: "",
    currencyCode: baseCurrency,
    expenseDate: todayInputValue(),
    description: "",
    receiptUrl: ""
  };
}

function createEmptyWorkflowStep(): WorkflowStepFormState {
  return {
    name: "",
    approverIds: [],
    isRequired: true
  };
}

function createInitialWorkflowForm(): WorkflowFormState {
  return {
    name: "Default Approval Workflow",
    description: "",
    managerFirst: true,
    thresholdPercentage: "",
    specificApproverUserId: "",
    steps: [createEmptyWorkflowStep()]
  };
}

function readStoredSession(): Session | null {
  try {
    const storedValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    return JSON.parse(storedValue) as Session;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: ApiErrorPayload | null, fallbackMessage: string): string {
  return payload?.error?.message ?? payload?.message ?? fallbackMessage;
}

function extractFieldErrors(payload: ApiErrorPayload | null): Record<string, string> {
  return payload?.error?.details ?? {};
}

function formatDate(isoValue: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(isoValue));
}

function formatDateTime(isoValue: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoValue));
}

function formatCurrency(amount: string, currency: string): string {
  const parsedAmount = Number(amount);

  if (Number.isNaN(parsedAmount)) {
    return `${currency} ${amount}`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(parsedAmount);
}

function getStatusTone(status: string): string {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "DRAFT":
      return "neutral";
    default:
      return "info";
  }
}

function getActionLabel(action: string): string {
  return action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (character) => character.toUpperCase());
}

function mapWorkflowToForm(workflow: WorkflowSettingsSummary): WorkflowFormState {
  return {
    name: workflow.name,
    description: workflow.description ?? "",
    managerFirst: workflow.managerFirst,
    thresholdPercentage: workflow.ruleSummary.thresholdPercentage ? String(workflow.ruleSummary.thresholdPercentage) : "",
    specificApproverUserId: workflow.ruleSummary.specificApproverUserId ?? "",
    steps:
      workflow.stages
        .filter((stage) => stage.stepOrder > 0)
        .map((stage) => ({
          name: stage.name,
          approverIds: stage.approvers.map((approver) => approver.id),
          isRequired: stage.isRequired
        })) || [createEmptyWorkflowStep()]
  };
}

async function requestJson<T>(path: string, options: RequestJsonOptions = {}): Promise<ApiSuccessPayload<T>> {
  const { token, headers, ...init } = options;
  const hasFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(hasFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {})
    },
    ...init
  });

  const rawBody = (await response.json().catch(() => null)) as ApiSuccessPayload<T> | ApiErrorPayload | null;

  if (!response.ok) {
    const error = new Error(extractErrorMessage(rawBody as ApiErrorPayload | null, "Request failed"));
    (error as Error & { fieldErrors?: Record<string, string> }).fieldErrors = extractFieldErrors(rawBody as ApiErrorPayload | null);
    throw error;
  }

  return rawBody as ApiSuccessPayload<T>;
}

function StatusPill({ label }: { label: string }) {
  const tone = getStatusTone(label);
  return <span className={`status-pill status-pill-${tone}`}>{label}</span>;
}

function SectionBanner({ message, tone }: { message: string; tone: "success" | "danger" }) {
  return <div className={`inline-banner inline-banner-${tone}`}>{message}</div>;
}

export default function App() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState("");
  const [signupForm, setSignupForm] = useState<SignupFormState>(initialSignupForm);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginForm);
  const [authFieldErrors, setAuthFieldErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [session, setSession] = useState<Session | null>(() => readStoredSession());

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userActionMessage, setUserActionMessage] = useState("");
  const [userActionError, setUserActionError] = useState("");
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>(initialCreateUserForm);
  const [createUserErrors, setCreateUserErrors] = useState<Record<string, string>>({});
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AssignableRole>>({});
  const [managerDrafts, setManagerDrafts] = useState<Record<string, string>>({});
  const [roleUpdatePendingUserId, setRoleUpdatePendingUserId] = useState("");
  const [managerUpdatePendingUserId, setManagerUpdatePendingUserId] = useState("");

  const [categories, setCategories] = useState<ExpenseCategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState("");
  const [expenseMessage, setExpenseMessage] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(createEmptyExpenseForm());
  const [expenseFieldErrors, setExpenseFieldErrors] = useState<Record<string, string>>({});
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(null);
  const [receiptUploadMessage, setReceiptUploadMessage] = useState("");
  const [receiptUploadPending, setReceiptUploadPending] = useState(false);
  const [ocrApplyPendingExpenseId, setOcrApplyPendingExpenseId] = useState("");
  const [reportExportPendingType, setReportExportPendingType] = useState("");
  const [submittingExpenseId, setSubmittingExpenseId] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [queueItems, setQueueItems] = useState<ExpenseSummary[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [approvalPendingKey, setApprovalPendingKey] = useState("");

  const [workflow, setWorkflow] = useState<WorkflowSettingsSummary | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [workflowFieldErrors, setWorkflowFieldErrors] = useState<Record<string, string>>({});
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>(createInitialWorkflowForm());
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState("");
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [dashboardReport, setDashboardReport] = useState<ReportDashboardSummary | null>(null);
  const [pendingByApproverReport, setPendingByApproverReport] = useState<PendingByApproverItem[]>([]);
  const [rejectionReport, setRejectionReport] = useState<RejectionReportItem[]>([]);
  const [agingReport, setAgingReport] = useState<AgingReportItem[]>([]);
  useEffect(() => {
    void loadCountries();
  }, []);

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }, [session]);

  const isAdmin = session?.user.roles.includes("ADMIN") ?? false;
  const canApprove = (session?.user.roles.includes("MANAGER") ?? false) || isAdmin;
  const selectedCountry = countries.find((country) => country.countryCode === signupForm.countryCode);
  const managerCandidates = users.filter((user) => user.role === "MANAGER");
  const workflowApproverCandidates = users.filter((user) => user.role === "MANAGER" || user.role === "ADMIN");
  const employeeCount = users.filter((user) => user.role === "EMPLOYEE").length;
  const managerCount = users.filter((user) => user.role === "MANAGER").length;
  const unreadNotificationCount = notifications.filter((notification) => !notification.readAt).length;

  const expenseStats = useMemo(
    () => ({
      total: expenses.length,
      drafts: expenses.filter((expense) => expense.status === "DRAFT").length,
      approved: expenses.filter((expense) => expense.status === "APPROVED").length,
      rejected: expenses.filter((expense) => expense.status === "REJECTED").length
    }),
    [expenses]
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadWorkspaceData(session);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setExpenseForm(createEmptyExpenseForm());
      return;
    }

    setExpenseForm((current) => ({
      ...current,
      currencyCode: current.currencyCode || session.company.baseCurrency
    }));
  }, [session]);

  function clearWorkspaceMessages(): void {
    setUserActionMessage("");
    setUserActionError("");
    setExpenseMessage("");
    setExpenseError("");
    setReceiptUploadMessage("");
    setApprovalMessage("");
    setApprovalError("");
    setWorkflowMessage("");
    setWorkflowError("");
    setNotificationsError("");
    setReportsError("");
  }

  function syncUserDrafts(nextUsers: UserSummary[]): void {
    setRoleDrafts(
      nextUsers.reduce<Record<string, AssignableRole>>((accumulator, user) => {
        if (user.role === "EMPLOYEE" || user.role === "MANAGER") {
          accumulator[user.id] = user.role;
        }

        return accumulator;
      }, {})
    );

    setManagerDrafts(
      nextUsers.reduce<Record<string, string>>((accumulator, user) => {
        accumulator[user.id] = user.manager?.id ?? "";
        return accumulator;
      }, {})
    );
  }

  async function loadCountries(refresh = false): Promise<void> {
    setCountriesLoading(true);
    setCountriesError("");

    try {
      const response = await requestJson<CountryOption[]>(
        `/metadata/countries${refresh ? "?refresh=true" : ""}`
      );

      setCountries(response.data);
    } catch (error) {
      setCountriesError(error instanceof Error ? error.message : "Unable to load countries");
    } finally {
      setCountriesLoading(false);
    }
  }

  async function loadWorkspaceData(currentSession: Session): Promise<void> {
    const currentIsAdmin = currentSession.user.roles.includes("ADMIN");
    const currentCanApprove = currentSession.user.roles.includes("MANAGER") || currentIsAdmin;

    clearWorkspaceMessages();
    setUsersError("");
    setCategoriesError("");
    setExpensesError("");
    setQueueError("");
    setWorkflowError("");
    setNotificationsError("");
    setReportsError("");

    setCategoriesLoading(true);
    setExpensesLoading(true);
    setNotificationsLoading(true);

    if (currentIsAdmin) {
      setUsersLoading(true);
      setWorkflowLoading(true);
    }

    if (currentCanApprove) {
      setQueueLoading(true);
      setReportsLoading(true);
    }

    try {
      const [categoriesResponse, expensesResponse, notificationsResponse] = await Promise.all([
        requestJson<ExpenseCategorySummary[]>("/expenses/categories", {
          token: currentSession.accessToken
        }),
        requestJson<ExpenseSummary[]>("/expenses", {
          token: currentSession.accessToken
        }),
        requestJson<NotificationSummary[]>("/notifications", {
          token: currentSession.accessToken
        })
      ]);

      setCategories(categoriesResponse.data);
      setExpenses(expensesResponse.data);
      setNotifications(notificationsResponse.data);

      if (currentIsAdmin) {
        const [usersResponse, workflowResponse] = await Promise.all([
          requestJson<UserSummary[]>("/users", {
            token: currentSession.accessToken
          }),
          requestJson<WorkflowSettingsSummary>("/workflows/default", {
            token: currentSession.accessToken
          })
        ]);

        setUsers(usersResponse.data);
        syncUserDrafts(usersResponse.data);
        setWorkflow(workflowResponse.data);
        setWorkflowForm(mapWorkflowToForm(workflowResponse.data));
      }

      if (currentCanApprove) {
        const [queueResponse, dashboardResponse, pendingByApproverResponse, rejectionResponse, agingResponse] =
          await Promise.all([
            requestJson<ExpenseSummary[]>("/expenses/queue", {
              token: currentSession.accessToken
            }),
            requestJson<ReportDashboardSummary>("/reports/dashboard", {
              token: currentSession.accessToken
            }),
            requestJson<PendingByApproverItem[]>("/reports/pending-by-approver", {
              token: currentSession.accessToken
            }),
            requestJson<RejectionReportItem[]>("/reports/rejections", {
              token: currentSession.accessToken
            }),
            requestJson<AgingReportItem[]>("/reports/aging", {
              token: currentSession.accessToken
            })
          ]);

        setQueueItems(queueResponse.data);
        setDashboardReport(dashboardResponse.data);
        setPendingByApproverReport(pendingByApproverResponse.data);
        setRejectionReport(rejectionResponse.data);
        setAgingReport(agingResponse.data);
      } else {
        setQueueItems([]);
        setDashboardReport(null);
        setPendingByApproverReport([]);
        setRejectionReport([]);
        setAgingReport([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load workspace";
      setExpensesError(message);
    } finally {
      setCategoriesLoading(false);
      setExpensesLoading(false);
      setUsersLoading(false);
      setWorkflowLoading(false);
      setQueueLoading(false);
      setNotificationsLoading(false);
      setReportsLoading(false);
    }
  }

  function validateSignupForm(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (signupForm.companyName.trim().length < 3) {
      errors.companyName = "Company name should be at least 3 characters";
    }

    if (!signupForm.countryCode) {
      errors.countryCode = "Select a country";
    }

    if (signupForm.firstName.trim().length < 2) {
      errors.firstName = "First name should be at least 2 characters";
    }

    if (signupForm.lastName.trim().length < 2) {
      errors.lastName = "Last name should be at least 2 characters";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email)) {
      errors.email = "Enter a valid email address";
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/.test(signupForm.password)) {
      errors.password = "Use 8+ characters with uppercase, lowercase, and a number";
    }

    return errors;
  }

  function validateLoginForm(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginForm.email)) {
      errors.email = "Enter a valid email address";
    }

    if (!loginForm.password.trim()) {
      errors.password = "Enter your password";
    }

    return errors;
  }

  function validateCreateUserForm(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (createUserForm.firstName.trim().length < 2) {
      errors.firstName = "First name should be at least 2 characters";
    }

    if (createUserForm.lastName.trim().length < 2) {
      errors.lastName = "Last name should be at least 2 characters";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserForm.email)) {
      errors.email = "Enter a valid email address";
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/.test(createUserForm.password)) {
      errors.password = "Use 8+ characters with uppercase, lowercase, and a number";
    }

    return errors;
  }

  function validateExpenseForm(): Record<string, string> {
    return validateExpenseDraft(expenseForm);
  }

  function validateWorkflowForm(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (workflowForm.name.trim().length < 3) {
      errors.name = "Workflow name should be at least 3 characters";
    }

    workflowForm.steps.forEach((step, index) => {
      if (step.name.trim().length < 2) {
        errors[`steps.${index}.name`] = "Step name should be at least 2 characters";
      }

      if (step.approverIds.length === 0) {
        errors[`steps.${index}.approverIds`] = "Select at least one approver";
      }
    });

    if (workflowForm.thresholdPercentage.trim()) {
      const threshold = Number(workflowForm.thresholdPercentage);

      if (Number.isNaN(threshold) || threshold < 1 || threshold > 100) {
        errors.thresholdPercentage = "Threshold should be between 1 and 100";
      }
    }

    if (
      workflowForm.specificApproverUserId &&
      !workflowForm.steps.some((step) => step.approverIds.includes(workflowForm.specificApproverUserId))
    ) {
      errors.specificApproverUserId = "Specific approver should also be part of one workflow step";
    }

    return errors;
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const validationErrors = validateSignupForm();
    setAuthFieldErrors(validationErrors);
    setAuthError("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmittingAuth(true);

    try {
      const response = await requestJson<Session>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(signupForm)
      });

      setSession(response.data);
      setSignupForm(initialSignupForm);
      setAuthFieldErrors({});
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to create account");
      setAuthFieldErrors((error as Error & { fieldErrors?: Record<string, string> }).fieldErrors ?? {});
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const validationErrors = validateLoginForm();
    setAuthFieldErrors(validationErrors);
    setAuthError("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmittingAuth(true);

    try {
      const response = await requestJson<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm)
      });

      setSession(response.data);
      setLoginForm(initialLoginForm);
      setAuthFieldErrors({});
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to log in");
      setAuthFieldErrors((error as Error & { fieldErrors?: Record<string, string> }).fieldErrors ?? {});
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleCreateUserSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!session) {
      return;
    }

    const validationErrors = validateCreateUserForm();
    setCreateUserErrors(validationErrors);
    setUserActionError("");
    setUserActionMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsCreatingUser(true);

    try {
      await requestJson<UserSummary>("/users", {
        method: "POST",
        token: session.accessToken,
        body: JSON.stringify(createUserForm)
      });

      setCreateUserForm(initialCreateUserForm);
      setCreateUserErrors({});
      setUserActionMessage("User created successfully.");
      await loadWorkspaceData(session);
    } catch (error) {
      setUserActionError(error instanceof Error ? error.message : "Unable to create user");
      setCreateUserErrors((error as Error & { fieldErrors?: Record<string, string> }).fieldErrors ?? {});
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleRoleUpdate(userId: string): Promise<void> {
    if (!session) {
      return;
    }

    const nextRole = roleDrafts[userId];

    if (!nextRole) {
      return;
    }

    setRoleUpdatePendingUserId(userId);
    setUserActionError("");
    setUserActionMessage("");

    try {
      await requestJson<UserSummary>(`/users/${userId}/role`, {
        method: "PATCH",
        token: session.accessToken,
        body: JSON.stringify({ role: nextRole })
      });

      setUserActionMessage("Role updated successfully.");
      await loadWorkspaceData(session);
    } catch (error) {
      setUserActionError(error instanceof Error ? error.message : "Unable to update role");
    } finally {
      setRoleUpdatePendingUserId("");
    }
  }

  async function handleManagerAssignment(userId: string): Promise<void> {
    if (!session) {
      return;
    }

    const selectedManagerId = managerDrafts[userId];

    if (!selectedManagerId) {
      setUserActionError("Select a manager before saving.");
      setUserActionMessage("");
      return;
    }

    setManagerUpdatePendingUserId(userId);
    setUserActionError("");
    setUserActionMessage("");

    try {
      await requestJson<UserSummary>(`/users/${userId}/manager`, {
        method: "POST",
        token: session.accessToken,
        body: JSON.stringify({ managerUserId: selectedManagerId })
      });

      setUserActionMessage("Manager updated successfully.");
      await loadWorkspaceData(session);
    } catch (error) {
      setUserActionError(error instanceof Error ? error.message : "Unable to assign manager");
    } finally {
      setManagerUpdatePendingUserId("");
    }
  }

  function handleReceiptFileChange(event: ChangeEvent<HTMLInputElement>): void {
    setSelectedReceiptFile(event.target.files?.[0] ?? null);
    setReceiptUploadMessage("");
    setExpenseError("");
  }

  async function uploadReceiptForExpense(expenseId: string): Promise<ExpenseSummary | null> {
    if (!session || !selectedReceiptFile) {
      return null;
    }

    setReceiptUploadPending(true);

    try {
      const formData = new FormData();
      formData.append("receipt", selectedReceiptFile);

      const response = await requestJson<ReceiptUploadResult>(`/expenses/${expenseId}/receipt`, {
        method: "POST",
        token: session.accessToken,
        body: formData
      });
      const { extraction } = response.data;

      if (extraction.status === "COMPLETED") {
        setReceiptUploadMessage(
          `Receipt uploaded. OCR found ${extraction.amount ? `${extraction.currency ?? session.company.baseCurrency} ${extraction.amount}` : "expense values"}${extraction.merchantName ? ` from ${extraction.merchantName}` : ""}.`
        );
      } else if (extraction.status === "NOT_SUPPORTED") {
        setReceiptUploadMessage(extraction.errorMessage ?? "Receipt uploaded, but OCR is not supported for this file.");
      } else {
        setReceiptUploadMessage(extraction.errorMessage ?? "Receipt uploaded, but OCR could not extract enough text.");
      }

      setSelectedReceiptFile(null);
      return response.data.expense;
    } finally {
      setReceiptUploadPending(false);
    }
  }

  async function handleExpenseSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!session) {
      return;
    }

    const validationErrors = validateExpenseForm();
    setExpenseFieldErrors(validationErrors);
    setExpenseError("");
    setExpenseMessage("");
    setReceiptUploadMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSavingExpense(true);

    try {
      const payload = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        receiptUrl: expenseForm.receiptUrl.trim() || null
      };
      let savedExpense: ExpenseSummary;

      if (editingExpenseId) {
        const response = await requestJson<ExpenseSummary>(`/expenses/${editingExpenseId}`, {
          method: "PATCH",
          token: session.accessToken,
          body: JSON.stringify(payload)
        });
        savedExpense = response.data;

        setExpenseMessage("Expense draft updated successfully.");
      } else {
        const response = await requestJson<ExpenseSummary>("/expenses", {
          method: "POST",
          token: session.accessToken,
          body: JSON.stringify(payload)
        });
        savedExpense = response.data;

        setExpenseMessage("Expense draft created successfully.");
      }

      if (selectedReceiptFile) {
        const uploadedExpense = await uploadReceiptForExpense(savedExpense.id);

        if (uploadedExpense) {
          savedExpense = uploadedExpense;
        }
      }

      setExpenseForm(createEmptyExpenseForm(session.company.baseCurrency));
      setEditingExpenseId(null);
      setSelectedReceiptFile(null);
      setExpenseFieldErrors({});
      await loadWorkspaceData(session);
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : "Unable to save expense");
      setExpenseFieldErrors((error as Error & { fieldErrors?: Record<string, string> }).fieldErrors ?? {});
    } finally {
      setIsSavingExpense(false);
    }
  }

  function handleExpenseEditStart(expense: ExpenseSummary): void {
    setEditingExpenseId(expense.id);
    setExpenseMessage("");
    setExpenseError("");
    setReceiptUploadMessage("");
    setExpenseFieldErrors({});
    setSelectedReceiptFile(null);
    setExpenseForm({
      categoryId: expense.category.id,
      amount: expense.amountOriginal,
      currencyCode: expense.originalCurrency,
      expenseDate: expense.expenseDate.slice(0, 10),
      description: expense.description ?? "",
      receiptUrl: expense.receipt?.sourceType === "URL" ? expense.receipt.fileUrl : ""
    });
  }

  function handleExpenseReset(): void {
    setEditingExpenseId(null);
    setExpenseFieldErrors({});
    setExpenseError("");
    setExpenseMessage("");
    setReceiptUploadMessage("");
    setSelectedReceiptFile(null);
    setExpenseForm(createEmptyExpenseForm(session?.company.baseCurrency ?? ""));
  }

  async function handleExpenseSubmit(expenseId: string): Promise<void> {
    if (!session) {
      return;
    }

    setSubmittingExpenseId(expenseId);
    setExpenseError("");
    setExpenseMessage("");

    try {
      await requestJson<ExpenseSummary>(`/expenses/${expenseId}/submit`, {
        method: "POST",
        token: session.accessToken
      });

      setExpenseMessage("Expense submitted for approval.");
      await loadWorkspaceData(session);
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : "Unable to submit expense");
    } finally {
      setSubmittingExpenseId("");
    }
  }

  async function handleApprovalAction(expenseId: string, action: "APPROVE" | "REJECT", override = false): Promise<void> {
    if (!session) {
      return;
    }

    const comment = approvalComments[expenseId]?.trim() ?? "";
    const pendingKey = `${override ? "override" : "action"}-${expenseId}-${action}`;

    setApprovalPendingKey(pendingKey);
    setApprovalMessage("");
    setApprovalError("");

    try {
      await requestJson<ExpenseSummary>(override ? `/expenses/${expenseId}/override` : `/expenses/${expenseId}/action`, {
        method: "POST",
        token: session.accessToken,
        body: JSON.stringify({
          action,
          comment: comment || null
        })
      });

      setApprovalComments((current) => ({
        ...current,
        [expenseId]: ""
      }));
      setApprovalMessage(
        override
          ? `Expense ${action.toLowerCase()}d by admin override.`
          : `Expense ${action.toLowerCase()}d successfully.`
      );
      await loadWorkspaceData(session);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "Unable to update approval");
    } finally {
      setApprovalPendingKey("");
    }
  }

  async function handleWorkflowSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!session || !isAdmin) {
      return;
    }

    const validationErrors = validateWorkflowForm();
    setWorkflowFieldErrors(validationErrors);
    setWorkflowError("");
    setWorkflowMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSavingWorkflow(true);

    try {
      const payload = {
        name: workflowForm.name.trim(),
        description: workflowForm.description.trim() || null,
        managerFirst: workflowForm.managerFirst,
        thresholdPercentage: workflowForm.thresholdPercentage.trim() ? Number(workflowForm.thresholdPercentage) : null,
        specificApproverUserId: workflowForm.specificApproverUserId || null,
        steps: workflowForm.steps.map((step) => ({
          name: step.name.trim(),
          approverIds: step.approverIds,
          isRequired: step.isRequired
        }))
      };

      const response = await requestJson<WorkflowSettingsSummary>("/workflows/default", {
        method: "PUT",
        token: session.accessToken,
        body: JSON.stringify(payload)
      });

      setWorkflow(response.data);
      setWorkflowForm(mapWorkflowToForm(response.data));
      setWorkflowFieldErrors({});
      setWorkflowMessage("Approval workflow saved successfully.");
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "Unable to save workflow");
      setWorkflowFieldErrors((error as Error & { fieldErrors?: Record<string, string> }).fieldErrors ?? {});
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  async function handleApplyReceiptOcr(expenseId: string): Promise<void> {
    if (!session) {
      return;
    }

    setOcrApplyPendingExpenseId(expenseId);
    setExpenseError("");
    setExpenseMessage("");
    setReceiptUploadMessage("");

    try {
      await requestJson<ExpenseSummary>(`/expenses/${expenseId}/receipt/apply-ocr`, {
        method: "POST",
        token: session.accessToken
      });

      setExpenseMessage("OCR suggestions applied to the draft expense.");
      await loadWorkspaceData(session);
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : "Unable to apply OCR values");
    } finally {
      setOcrApplyPendingExpenseId("");
    }
  }

  async function handleReportExport(type: "dashboard" | "pending-by-approver" | "rejections" | "aging"): Promise<void> {
    if (!session) {
      return;
    }

    setReportExportPendingType(type);
    setReportsError("");

    try {
      const response = await fetch(`${API_BASE_URL}/reports/export?type=${encodeURIComponent(type)}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Unable to export report");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/i);

      anchor.href = downloadUrl;
      anchor.download = fileNameMatch?.[1] ?? `${type}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setReportsError(error instanceof Error ? error.message : "Unable to export report");
    } finally {
      setReportExportPendingType("");
    }
  }

  async function handleNotificationRead(notificationId: string): Promise<void> {
    if (!session) {
      return;
    }

    setMarkingNotificationId(notificationId);
    setNotificationsError("");

    try {
      await requestJson<NotificationSummary>(`/notifications/${notificationId}/read`, {
        method: "PATCH",
        token: session.accessToken
      });

      await loadWorkspaceData(session);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Unable to update notification");
    } finally {
      setMarkingNotificationId("");
    }
  }

  async function handleReadAllNotifications(): Promise<void> {
    if (!session) {
      return;
    }

    setMarkingAllNotifications(true);
    setNotificationsError("");

    try {
      await requestJson<{ updatedCount: number }>("/notifications/read-all", {
        method: "PATCH",
        token: session.accessToken
      });

      await loadWorkspaceData(session);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Unable to update notifications");
    } finally {
      setMarkingAllNotifications(false);
    }
  }

  function updateWorkflowStepApprovers(index: number, event: ChangeEvent<HTMLSelectElement>): void {
    const approverIds = Array.from(event.target.selectedOptions).map((option) => option.value);

    setWorkflowForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index
          ? {
              ...step,
              approverIds
            }
          : step
      )
    }));
  }

  function handleLogout(): void {
    setSession(null);
    setMode("login");
    setAuthError("");
    setAuthFieldErrors({});
    setUsers([]);
    setCategories([]);
    setExpenses([]);
    setQueueItems([]);
    setWorkflow(null);
    setNotifications([]);
    setDashboardReport(null);
    setPendingByApproverReport([]);
    setRejectionReport([]);
    setAgingReport([]);
    clearWorkspaceMessages();
    setExpenseForm(createEmptyExpenseForm());
    setSelectedReceiptFile(null);
    setEditingExpenseId(null);
  }

  if (session) {
    return (
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{session.company.name}</h2>
            <p className="sidebar-copy">
              {session.user.fullName}
              <br />
              {session.user.roles.join(" / ")}
            </p>
          </div>

          <nav className="dashboard-nav">
            <a href="#overview">Overview</a>
            {isAdmin ? <a href="#user-management">Users</a> : null}
            <a href="#expense-workspace">Expenses</a>
            {canApprove ? <a href="#approval-queue">Approvals</a> : null}
            <a href="#notifications">Notifications</a>
            {canApprove ? <a href="#reports">Reports</a> : null}
            {isAdmin ? <a href="#workflow-settings">Workflow</a> : null}
          </nav>

          <button className="ghost-button" type="button" onClick={() => void loadWorkspaceData(session)}>
            Refresh Workspace
          </button>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </aside>

        <main className="dashboard-main">
          <header className="welcome-card" id="overview">
            <div>
              <p className="eyebrow">Reimbursement Management</p>
              <h1>{session.user.fullName}</h1>
              <p className="welcome-copy">
                This workspace now covers company onboarding, user management, expense drafting and
                submission, approval queues, and configurable multi-step approval rules with
                manager-first and threshold behavior.
              </p>
            </div>
            <div className="badge-stack">
              <span className="pill">{session.user.roles.join(" / ")}</span>
              <span className="pill pill-soft">
                {session.company.countryCode} | {session.company.baseCurrency}
              </span>
            </div>
          </header>

          <section className="metrics-grid">
            <article className="metric-card">
              <span className="metric-label">Base Currency</span>
              <strong>{session.company.baseCurrency}</strong>
              <p>All approvals compare values in the company currency after live conversion.</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Expenses</span>
              <strong>{expenseStats.total}</strong>
              <p>{expenseStats.drafts} drafts, {expenseStats.approved} approved, {expenseStats.rejected} rejected.</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Pending Queue</span>
              <strong>{queueItems.length}</strong>
              <p>{canApprove ? "Items currently waiting for your decision." : "Approval access depends on your role."}</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Unread Notifications</span>
              <strong>{unreadNotificationCount}</strong>
              <p>Approval movement, final decisions, and action reminders appear here.</p>
            </article>
          </section>

          <section className="next-step-grid">
            <article className="roadmap-card">
              <h3>Workspace Coverage</h3>
              <ul>
                <li>Dynamic country and currency setup</li>
                <li>Admin user and manager hierarchy management</li>
                <li>Expense draft creation, editing, and submission</li>
                <li>Approval queue with sequential, threshold, and override flow</li>
              </ul>
            </article>

            <article className="roadmap-card">
              <h3>Phase 2 Placeholder</h3>
              <ul>
                <li>Receipt OCR extraction and auto-fill</li>
                <li>Smarter duplicate detection scoring</li>
                <li>Export-ready reports and printable summaries</li>
                <li>Attachment upload pipeline beyond URL-based receipts</li>
              </ul>
            </article>
          </section>

          {isAdmin ? (
            <section className="management-grid" id="user-management">
              <article className="management-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h3>Create team member</h3>
                  </div>
                  <span className="mini-chip">Role + password setup</span>
                </div>

                {userActionMessage ? <SectionBanner message={userActionMessage} tone="success" /> : null}
                {userActionError ? <SectionBanner message={userActionError} tone="danger" /> : null}
                {usersError ? <SectionBanner message={usersError} tone="danger" /> : null}

                <form className="auth-form" onSubmit={(event) => void handleCreateUserSubmit(event)}>
                  <div className="field-row">
                    <label className="field">
                      <span>First name</span>
                      <input value={createUserForm.firstName} onChange={(event) => setCreateUserForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="Shraddha" />
                      {createUserErrors.firstName ? <small>{createUserErrors.firstName}</small> : null}
                    </label>
                    <label className="field">
                      <span>Last name</span>
                      <input value={createUserForm.lastName} onChange={(event) => setCreateUserForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Bhadane" />
                      {createUserErrors.lastName ? <small>{createUserErrors.lastName}</small> : null}
                    </label>
                  </div>

                  <label className="field">
                    <span>Email</span>
                    <input type="email" value={createUserForm.email} onChange={(event) => setCreateUserForm((current) => ({ ...current, email: event.target.value }))} placeholder="teammate@company.com" />
                    {createUserErrors.email ? <small>{createUserErrors.email}</small> : null}
                  </label>

                  <div className="field-row">
                    <label className="field">
                      <span>Temporary password</span>
                      <input type="password" value={createUserForm.password} onChange={(event) => setCreateUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="Use uppercase, lowercase, and a number" />
                      {createUserErrors.password ? <small>{createUserErrors.password}</small> : null}
                    </label>
                    <label className="field">
                      <span>Role</span>
                      <select value={createUserForm.role} onChange={(event) => setCreateUserForm((current) => ({ ...current, role: event.target.value as AssignableRole }))}>
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                      </select>
                    </label>
                  </div>

                  <button className="primary-button" type="submit" disabled={isCreatingUser}>{isCreatingUser ? "Creating user..." : "Create user"}</button>
                </form>
              </article>

              <article className="management-card management-card-wide">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h3>Company users</h3>
                  </div>
                  <span className="mini-chip">{usersLoading ? "Refreshing..." : `${employeeCount} employees | ${managerCount} managers`}</span>
                </div>

                {usersLoading ? (
                  <div className="loading-panel">Loading users...</div>
                ) : (
                  <div className="user-card-list">
                    {users.map((user) => {
                      const isAdminRow = user.role === "ADMIN";
                      const availableManagers = managerCandidates.filter((manager) => manager.id !== user.id);

                      return (
                        <article className="user-card" key={user.id}>
                          <div className="user-card-header">
                            <div>
                              <h4>{user.fullName}</h4>
                              <p>{user.email}</p>
                            </div>
                            <span className={`status-pill status-pill-${user.role.toLowerCase()}`}>{user.role}</span>
                          </div>

                          <div className="user-meta-grid">
                            <div><span className="meta-label">Created</span><strong>{formatDate(user.createdAt)}</strong></div>
                            <div><span className="meta-label">Status</span><strong>{user.status}</strong></div>
                            <div><span className="meta-label">Manager</span><strong>{user.manager?.fullName ?? "Not assigned"}</strong></div>
                          </div>

                          {isAdminRow ? (
                            <p className="admin-note">The first admin account stays protected here so the workspace always keeps administrative access.</p>
                          ) : (
                            <div className="user-actions-grid">
                              <label className="field">
                                <span>Role</span>
                                <select value={roleDrafts[user.id] ?? "EMPLOYEE"} onChange={(event) => setRoleDrafts((current) => ({ ...current, [user.id]: event.target.value as AssignableRole }))}>
                                  <option value="EMPLOYEE">Employee</option>
                                  <option value="MANAGER">Manager</option>
                                </select>
                              </label>
                              <label className="field">
                                <span>Reporting manager</span>
                                <select value={managerDrafts[user.id] ?? ""} onChange={(event) => setManagerDrafts((current) => ({ ...current, [user.id]: event.target.value }))} disabled={availableManagers.length === 0}>
                                  <option value="">{availableManagers.length === 0 ? "No manager available" : "Select manager"}</option>
                                  {availableManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName}</option>)}
                                </select>
                              </label>
                              <div className="action-button-row">
                                <button className="ghost-button" type="button" disabled={roleUpdatePendingUserId === user.id} onClick={() => void handleRoleUpdate(user.id)}>{roleUpdatePendingUserId === user.id ? "Saving role..." : "Save role"}</button>
                                <button className="primary-button" type="button" disabled={managerUpdatePendingUserId === user.id || availableManagers.length === 0} onClick={() => void handleManagerAssignment(user.id)}>{managerUpdatePendingUserId === user.id ? "Saving manager..." : "Save manager"}</button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>
            </section>
          ) : null}

          <section className="workspace-grid" id="expense-workspace">
            <article className="workspace-card">
              <div className="section-heading">
                <div><p className="eyebrow">Expenses</p><h3>{editingExpenseId ? "Edit expense draft" : "Create expense draft"}</h3></div>
                <span className="mini-chip">Live conversion + validation</span>
              </div>
              {expenseMessage ? <SectionBanner message={expenseMessage} tone="success" /> : null}
              {expenseError ? <SectionBanner message={expenseError} tone="danger" /> : null}
              {categoriesError ? <SectionBanner message={categoriesError} tone="danger" /> : null}

              <form className="auth-form" onSubmit={(event) => void handleExpenseSave(event)}>
                <div className="field-row">
                  <label className="field">
                    <span>Category</span>
                    <select value={expenseForm.categoryId} onChange={(event) => setExpenseForm((current) => ({ ...current, categoryId: event.target.value }))}>
                      <option value="">{categoriesLoading ? "Loading categories..." : "Select category"}</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    {expenseFieldErrors.categoryId ? <small>{expenseFieldErrors.categoryId}</small> : null}
                  </label>
                  <label className="field">
                    <span>Expense date</span>
                    <input type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))} />
                    {expenseFieldErrors.expenseDate ? <small>{expenseFieldErrors.expenseDate}</small> : null}
                  </label>
                </div>

                <div className="field-row">
                  <label className="field">
                    <span>Amount</span>
                    <input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="1250.50" />
                    {expenseFieldErrors.amount ? <small>{expenseFieldErrors.amount}</small> : null}
                  </label>
                  <label className="field">
                    <span>Currency</span>
                    <input value={expenseForm.currencyCode} onChange={(event) => setExpenseForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} placeholder={session.company.baseCurrency} maxLength={3} />
                    {expenseFieldErrors.currencyCode ? <small>{expenseFieldErrors.currencyCode}</small> : null}
                  </label>
                </div>

                <label className="field">
                  <span>Description</span>
                  <textarea value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder="Client meeting dinner, airport taxi, team travel, office purchase..." rows={4} />
                  {expenseFieldErrors.description ? <small>{expenseFieldErrors.description}</small> : null}
                </label>

                <div className="field-row">
                  <label className="field">
                    <span>Receipt upload</span>
                    <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" onChange={handleReceiptFileChange} />
                    <small className="helper-copy">{selectedReceiptFile ? `${selectedReceiptFile.name} selected for upload and OCR.` : "Upload an image, PDF, or TXT receipt for local storage and OCR extraction."}</small>
                  </label>
                  <label className="field">
                    <span>Receipt link fallback (optional)</span>
                    <input value={expenseForm.receiptUrl} onChange={(event) => setExpenseForm((current) => ({ ...current, receiptUrl: event.target.value }))} placeholder="https://..." />
                    {expenseFieldErrors.receiptUrl ? <small>{expenseFieldErrors.receiptUrl}</small> : <small className="helper-copy">Use this only when you do not have a local receipt file ready.</small>}
                  </label>
                </div>
                {receiptUploadMessage ? <SectionBanner message={receiptUploadMessage} tone="success" /> : null}

                <div className="action-button-row">
                  <button className="primary-button" type="submit" disabled={isSavingExpense || receiptUploadPending}>{isSavingExpense || receiptUploadPending ? "Saving draft..." : editingExpenseId ? "Update draft" : "Save draft"}</button>
                  {editingExpenseId ? <button className="ghost-button" type="button" onClick={handleExpenseReset}>Cancel edit</button> : null}
                </div>
              </form>
            </article>

            <article className="workspace-card workspace-card-wide">
              <div className="section-heading">
                <div><p className="eyebrow">History</p><h3>{isAdmin ? "Company expenses" : canApprove ? "Team and personal expenses" : "Your expenses"}</h3></div>
                <span className="mini-chip">{expensesLoading ? "Refreshing..." : `${expenses.length} record${expenses.length === 1 ? "" : "s"}`}</span>
              </div>
              {expensesError ? <SectionBanner message={expensesError} tone="danger" /> : null}

              {expensesLoading ? (
                <div className="loading-panel">Loading expenses...</div>
              ) : expenses.length === 0 ? (
                <div className="empty-panel"><h4>No expenses yet</h4><p>Create your first draft to start the reimbursement workflow.</p></div>
              ) : (
                <div className="expense-card-list">
                  {expenses.map((expense) => (
                    <article className="expense-card" key={expense.id}>
                      <div className="expense-card-top">
                        <div>
                          <h4>{expense.category.name}</h4>
                          <p>{expense.employee.fullName}<span className="dot-divider">•</span>{formatDate(expense.expenseDate)}</p>
                        </div>
                        <StatusPill label={expense.status} />
                      </div>

                      <div className="expense-amount-row">
                        <strong>{formatCurrency(expense.amountOriginal, expense.originalCurrency)}</strong>
                        <span>{formatCurrency(expense.amountCompanyCurrency, expense.companyCurrency)}<small>Rate {expense.exchangeRate}</small></span>
                      </div>
                      <p className="expense-description">{expense.description}</p>

                      <div className="expense-meta-grid">
                        <div><span className="meta-label">Current stage</span><strong>{expense.approval.currentStageName ?? "Draft stage"}</strong></div>
                        <div><span className="meta-label">Pending approvers</span><strong>{expense.approval.pendingApprovers.length > 0 ? expense.approval.pendingApprovers.map((approver) => approver.fullName).join(", ") : "No pending approver"}</strong></div>
                        <div><span className="meta-label">Receipt</span><strong>{expense.receipt ? <a href={expense.receipt.fileUrl} target="_blank" rel="noreferrer">Open receipt</a> : "Not attached"}</strong></div>
                      </div>

                      {expense.receipt ? (
                        <div className="receipt-insight-card">
                          <div className="receipt-insight-header">
                            <strong>Receipt OCR</strong>
                            <span className="mini-chip">{expense.receipt.ocrStatus.replaceAll("_", " ")}</span>
                          </div>
                          <p className="expense-description">
                            {expense.receipt.extractedMerchantName ?? expense.receipt.fileName}
                            <span className="dot-divider">|</span>
                            {expense.receipt.mimeType}
                          </p>
                          <div className="receipt-insight-grid">
                            <div><span className="meta-label">Extracted amount</span><strong>{expense.receipt.extractedAmount ? formatCurrency(expense.receipt.extractedAmount, expense.receipt.extractedCurrency ?? expense.originalCurrency) : "Not found"}</strong></div>
                            <div><span className="meta-label">Extracted date</span><strong>{expense.receipt.extractedDate ? formatDate(expense.receipt.extractedDate) : "Not found"}</strong></div>
                            <div><span className="meta-label">Suggested category</span><strong>{expense.receipt.suggestedCategoryName ?? "Not found"}</strong></div>
                          </div>
                          {expense.receipt.ocrErrorMessage ? <p className="expense-description">{expense.receipt.ocrErrorMessage}</p> : null}
                        </div>
                      ) : null}

                      {expense.approval.actions.length > 0 ? (
                        <div className="timeline-block">
                          <span className="meta-label">Approval timeline</span>
                          <div className="timeline-list">
                            {expense.approval.actions.map((action) => (
                              <div className="timeline-item" key={action.id}>
                                <strong>{getActionLabel(action.action)}</strong>
                                <span>{action.actor.fullName}<span className="dot-divider">•</span>{formatDateTime(action.actedAt)}</span>
                                {action.comment ? <p>{action.comment}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {expense.status === "DRAFT" && expense.employee.id === session.user.id ? (
                        <div className="action-button-row">
                          <button className="ghost-button" type="button" onClick={() => handleExpenseEditStart(expense)}>Edit draft</button>
                          {expense.receipt && (expense.receipt.extractedAmount || expense.receipt.extractedDate || expense.receipt.suggestedDescription || expense.receipt.suggestedCategoryName) ? (
                            <button className="ghost-button" type="button" disabled={ocrApplyPendingExpenseId === expense.id} onClick={() => void handleApplyReceiptOcr(expense.id)}>
                              {ocrApplyPendingExpenseId === expense.id ? "Applying OCR..." : "Apply OCR to draft"}
                            </button>
                          ) : null}
                          <button className="primary-button" type="button" disabled={submittingExpenseId === expense.id} onClick={() => void handleExpenseSubmit(expense.id)}>{submittingExpenseId === expense.id ? "Submitting..." : "Submit for approval"}</button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>

          {canApprove ? (
            <section className="workspace-card" id="approval-queue">
              <div className="section-heading">
                <div><p className="eyebrow">Approvals</p><h3>Queue waiting for your decision</h3></div>
                <span className="mini-chip">{queueLoading ? "Refreshing..." : `${queueItems.length} pending`}</span>
              </div>
              {approvalMessage ? <SectionBanner message={approvalMessage} tone="success" /> : null}
              {approvalError ? <SectionBanner message={approvalError} tone="danger" /> : null}
              {queueError ? <SectionBanner message={queueError} tone="danger" /> : null}

              {queueLoading ? (
                <div className="loading-panel">Loading approval queue...</div>
              ) : queueItems.length === 0 ? (
                <div className="empty-panel"><h4>Queue is clear</h4><p>No expense is currently waiting for your action.</p></div>
              ) : (
                <div className="queue-card-list">
                  {queueItems.map((expense) => (
                    <article className="queue-card" key={expense.id}>
                      <div className="expense-card-top">
                        <div><h4>{expense.employee.fullName}</h4><p>{expense.category.name}<span className="dot-divider">•</span>{formatDate(expense.expenseDate)}</p></div>
                        <StatusPill label={expense.status} />
                      </div>
                      <div className="expense-amount-row">
                        <strong>{formatCurrency(expense.amountCompanyCurrency, expense.companyCurrency)}</strong>
                        <span>{formatCurrency(expense.amountOriginal, expense.originalCurrency)}<small>{expense.approval.currentStageName ?? "Approval stage"}</small></span>
                      </div>
                      <p className="expense-description">{expense.description}</p>
                      <div className="chip-list">{expense.approval.pendingApprovers.map((approver) => <span className="mini-chip" key={approver.id}>{approver.fullName}</span>)}</div>
                      <label className="field">
                        <span>Comment</span>
                        <textarea rows={3} value={approvalComments[expense.id] ?? ""} onChange={(event) => setApprovalComments((current) => ({ ...current, [expense.id]: event.target.value }))} placeholder="Add approval note or rejection reason" />
                      </label>
                      <div className="action-button-row">
                        <button className="primary-button" type="button" disabled={approvalPendingKey === `action-${expense.id}-APPROVE`} onClick={() => void handleApprovalAction(expense.id, "APPROVE")}>{approvalPendingKey === `action-${expense.id}-APPROVE` ? "Approving..." : "Approve"}</button>
                        <button className="ghost-button danger-button" type="button" disabled={approvalPendingKey === `action-${expense.id}-REJECT`} onClick={() => void handleApprovalAction(expense.id, "REJECT")}>{approvalPendingKey === `action-${expense.id}-REJECT` ? "Rejecting..." : "Reject"}</button>
                        {isAdmin ? (
                          <>
                            <button className="ghost-button" type="button" disabled={approvalPendingKey === `override-${expense.id}-APPROVE`} onClick={() => void handleApprovalAction(expense.id, "APPROVE", true)}>{approvalPendingKey === `override-${expense.id}-APPROVE` ? "Overriding..." : "Admin override approve"}</button>
                            <button className="ghost-button danger-button" type="button" disabled={approvalPendingKey === `override-${expense.id}-REJECT`} onClick={() => void handleApprovalAction(expense.id, "REJECT", true)}>{approvalPendingKey === `override-${expense.id}-REJECT` ? "Overriding..." : "Admin override reject"}</button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="workspace-card" id="notifications">
            <div className="section-heading">
              <div><p className="eyebrow">Notifications</p><h3>Activity and final decision updates</h3></div>
              <div className="section-heading-actions">
                <span className="mini-chip">{notificationsLoading ? "Refreshing..." : `${unreadNotificationCount} unread`}</span>
                {notifications.length > 0 ? (
                  <button className="ghost-button" type="button" disabled={markingAllNotifications || unreadNotificationCount === 0} onClick={() => void handleReadAllNotifications()}>
                    {markingAllNotifications ? "Updating..." : "Mark all read"}
                  </button>
                ) : null}
              </div>
            </div>
            {notificationsError ? <SectionBanner message={notificationsError} tone="danger" /> : null}

            {notificationsLoading ? (
              <div className="loading-panel">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="empty-panel"><h4>No notifications yet</h4><p>Approval requests, movement between stages, and final decisions will appear here.</p></div>
            ) : (
              <div className="notification-list">
                {notifications.map((notification) => {
                  const payloadExpenseId = typeof notification.payload?.expenseId === "string" ? notification.payload.expenseId : null;

                  return (
                    <article className={`notification-item${notification.readAt ? " is-read" : ""}`} key={notification.id}>
                      <div className="notification-item-top">
                        <div>
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                        </div>
                        <span className={`notification-badge${notification.readAt ? " is-read" : ""}`}>
                          {notification.readAt ? "Read" : "Unread"}
                        </span>
                      </div>

                      <div className="notification-meta">
                        <span>{formatDateTime(notification.createdAt)}</span>
                        <span className="dot-divider">|</span>
                        <span>{notification.channel.toLowerCase()}</span>
                        {payloadExpenseId ? (
                          <>
                            <span className="dot-divider">|</span>
                            <span>Expense #{payloadExpenseId.slice(0, 8).toUpperCase()}</span>
                          </>
                        ) : null}
                      </div>

                      <div className="notification-actions">
                        <span className="notification-read-state">
                          {notification.readAt ? `Read on ${formatDateTime(notification.readAt)}` : "Waiting for you to acknowledge this update"}
                        </span>
                        {!notification.readAt ? (
                          <button className="ghost-button" type="button" disabled={markingNotificationId === notification.id} onClick={() => void handleNotificationRead(notification.id)}>
                            {markingNotificationId === notification.id ? "Saving..." : "Mark as read"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {canApprove ? (
            <section className="workspace-card" id="reports">
              <div className="section-heading">
                <div><p className="eyebrow">Reports</p><h3>Operational reporting for review teams</h3></div>
                <div className="section-heading-actions">
                  <span className="mini-chip">{reportsLoading ? "Refreshing..." : "Live company snapshot"}</span>
                  <button className="ghost-button" type="button" onClick={() => window.print()}>
                    Print summary
                  </button>
                  <button className="ghost-button" type="button" disabled={reportExportPendingType === "dashboard"} onClick={() => void handleReportExport("dashboard")}>
                    {reportExportPendingType === "dashboard" ? "Exporting..." : "Export dashboard CSV"}
                  </button>
                  <button className="ghost-button" type="button" disabled={reportExportPendingType === "aging"} onClick={() => void handleReportExport("aging")}>
                    {reportExportPendingType === "aging" ? "Exporting..." : "Export aging CSV"}
                  </button>
                  <button className="ghost-button" type="button" disabled={reportExportPendingType === "pending-by-approver"} onClick={() => void handleReportExport("pending-by-approver")}>
                    {reportExportPendingType === "pending-by-approver" ? "Exporting..." : "Export queue CSV"}
                  </button>
                  <button className="ghost-button" type="button" disabled={reportExportPendingType === "rejections"} onClick={() => void handleReportExport("rejections")}>
                    {reportExportPendingType === "rejections" ? "Exporting..." : "Export rejections CSV"}
                  </button>
                </div>
              </div>
              {reportsError ? <SectionBanner message={reportsError} tone="danger" /> : null}

              {reportsLoading ? (
                <div className="loading-panel">Loading reports...</div>
              ) : (
                <div className="report-stack">
                  <div className="report-stat-grid">
                    <article className="report-stat-card">
                      <span className="metric-label">Total expenses</span>
                      <strong>{dashboardReport?.totalExpenses ?? 0}</strong>
                      <p>All draft, in-review, approved, and rejected expenses in your scope.</p>
                    </article>
                    <article className="report-stat-card">
                      <span className="metric-label">Approved amount</span>
                      <strong>{formatCurrency(dashboardReport?.approvedAmountCompanyCurrency ?? "0", session.company.baseCurrency)}</strong>
                      <p>{dashboardReport?.approvedExpenses ?? 0} approved expenses converted to company currency.</p>
                    </article>
                    <article className="report-stat-card">
                      <span className="metric-label">In review amount</span>
                      <strong>{formatCurrency(dashboardReport?.inReviewAmountCompanyCurrency ?? "0", session.company.baseCurrency)}</strong>
                      <p>{dashboardReport?.inReviewExpenses ?? 0} expenses still moving through workflow stages.</p>
                    </article>
                    <article className="report-stat-card">
                      <span className="metric-label">Rejected expenses</span>
                      <strong>{dashboardReport?.rejectedExpenses ?? 0}</strong>
                      <p>Useful for spotting policy gaps, poor receipts, or duplicate submissions.</p>
                    </article>
                  </div>

                  <div className="report-grid">
                    <article className="report-panel">
                      <div className="section-heading">
                        <div><p className="eyebrow">Queue Load</p><h3>Pending by approver</h3></div>
                      </div>
                      {pendingByApproverReport.length === 0 ? (
                        <div className="empty-inline-state">No active in-review expenses are waiting in the current approval stages.</div>
                      ) : (
                        <div className="report-list">
                          {pendingByApproverReport.map((item) => (
                            <div className="report-list-item" key={item.approverId}>
                              <div>
                                <strong>{item.approverName}</strong>
                                <p>{item.approverEmail}</p>
                              </div>
                              <span className="report-count-chip">{item.pendingCount} pending</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>

                    <article className="report-panel">
                      <div className="section-heading">
                        <div><p className="eyebrow">Aging</p><h3>Oldest active approvals</h3></div>
                      </div>
                      {agingReport.length === 0 ? (
                        <div className="empty-inline-state">No in-review expenses are aging right now.</div>
                      ) : (
                        <div className="report-list">
                          {agingReport.slice(0, 6).map((item) => (
                            <div className="report-list-item" key={item.expenseId}>
                              <div>
                                <strong>{item.employeeName}</strong>
                                <p>{item.categoryName} | {item.currentStageName ?? "Approval stage"} | {item.pendingApprovers.join(", ") || "No pending approver"}</p>
                              </div>
                              <div className="report-amount-block">
                                <strong>{item.daysPending}d</strong>
                                <span>{formatCurrency(item.amountCompanyCurrency, item.companyCurrency)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>

                    <article className="report-panel report-panel-wide">
                      <div className="section-heading">
                        <div><p className="eyebrow">Rejections</p><h3>Recent rejected expenses</h3></div>
                      </div>
                      {rejectionReport.length === 0 ? (
                        <div className="empty-inline-state">No rejected expenses in your current reporting scope.</div>
                      ) : (
                        <div className="report-list">
                          {rejectionReport.map((item) => (
                            <div className="report-list-item report-list-item-expanded" key={item.expenseId}>
                              <div>
                                <strong>{item.employeeName}</strong>
                                <p>{item.categoryName} | {formatCurrency(item.amountCompanyCurrency, item.companyCurrency)}</p>
                                <p>{item.rejectedBy ? `Rejected by ${item.rejectedBy}` : "Rejected"}{item.rejectedAt ? ` on ${formatDateTime(item.rejectedAt)}` : ""}</p>
                              </div>
                              <div className="report-comment">
                                <span className="meta-label">Comment</span>
                                <p>{item.comment ?? "No rejection comment was provided."}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {isAdmin ? (
            <section className="workspace-card" id="workflow-settings">
              <div className="section-heading">
                <div><p className="eyebrow">Workflow</p><h3>Approval configuration</h3></div>
                <span className="mini-chip">{workflowLoading ? "Loading..." : workflow?.isDefault ? "Default workflow" : "Custom workflow"}</span>
              </div>
              {workflowMessage ? <SectionBanner message={workflowMessage} tone="success" /> : null}
              {workflowError ? <SectionBanner message={workflowError} tone="danger" /> : null}

              {workflowLoading ? (
                <div className="loading-panel">Loading workflow settings...</div>
              ) : (
                <form className="auth-form" onSubmit={(event) => void handleWorkflowSave(event)}>
                  <div className="field-row">
                    <label className="field">
                      <span>Workflow name</span>
                      <input value={workflowForm.name} onChange={(event) => setWorkflowForm((current) => ({ ...current, name: event.target.value }))} placeholder="Default Approval Workflow" />
                      {workflowFieldErrors.name ? <small>{workflowFieldErrors.name}</small> : null}
                    </label>
                    <label className="field">
                      <span>Manager first approval</span>
                      <select value={workflowForm.managerFirst ? "true" : "false"} onChange={(event) => setWorkflowForm((current) => ({ ...current, managerFirst: event.target.value === "true" }))}>
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span>Description</span>
                    <textarea rows={3} value={workflowForm.description} onChange={(event) => setWorkflowForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explain when this workflow should be used and how the approval path behaves." />
                  </label>

                  <div className="field-row">
                    <label className="field">
                      <span>Approval percentage rule</span>
                      <input type="number" min="1" max="100" value={workflowForm.thresholdPercentage} onChange={(event) => setWorkflowForm((current) => ({ ...current, thresholdPercentage: event.target.value }))} placeholder="60" />
                      {workflowFieldErrors.thresholdPercentage ? <small>{workflowFieldErrors.thresholdPercentage}</small> : <small>Optional. Example: 60 means 60% approvals can finalize the expense.</small>}
                    </label>
                    <label className="field">
                      <span>Specific approver override</span>
                      <select value={workflowForm.specificApproverUserId} onChange={(event) => setWorkflowForm((current) => ({ ...current, specificApproverUserId: event.target.value }))}>
                        <option value="">No specific override approver</option>
                        {workflowApproverCandidates.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.role})</option>)}
                      </select>
                      {workflowFieldErrors.specificApproverUserId ? <small>{workflowFieldErrors.specificApproverUserId}</small> : <small>Optional. This approver must also be assigned in one workflow step.</small>}
                    </label>
                  </div>

                  <div className="step-list">
                    {workflowForm.steps.map((step, index) => (
                      <article className="step-card" key={`workflow-step-${index}`}>
                        <div className="step-card-header">
                          <strong>Step {index + 1}</strong>
                          <button className="ghost-button" type="button" onClick={() => setWorkflowForm((current) => ({ ...current, steps: current.steps.length === 1 ? [createEmptyWorkflowStep()] : current.steps.filter((_, stepIndex) => stepIndex !== index) }))}>Remove</button>
                        </div>

                        <div className="field-row">
                          <label className="field">
                            <span>Step name</span>
                            <input value={step.name} onChange={(event) => setWorkflowForm((current) => ({ ...current, steps: current.steps.map((currentStep, stepIndex) => stepIndex === index ? { ...currentStep, name: event.target.value } : currentStep) }))} placeholder="Finance Review" />
                            {workflowFieldErrors[`steps.${index}.name`] ? <small>{workflowFieldErrors[`steps.${index}.name`]}</small> : null}
                          </label>
                          <label className="field">
                            <span>Required</span>
                            <select value={step.isRequired ? "true" : "false"} onChange={(event) => setWorkflowForm((current) => ({ ...current, steps: current.steps.map((currentStep, stepIndex) => stepIndex === index ? { ...currentStep, isRequired: event.target.value === "true" } : currentStep) }))}>
                              <option value="true">Required</option>
                              <option value="false">Optional</option>
                            </select>
                          </label>
                        </div>

                        <label className="field">
                          <span>Approvers</span>
                          <select multiple value={step.approverIds} onChange={(event) => updateWorkflowStepApprovers(index, event)}>
                            {workflowApproverCandidates.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.role})</option>)}
                          </select>
                          {workflowFieldErrors[`steps.${index}.approverIds`] ? <small>{workflowFieldErrors[`steps.${index}.approverIds`]}</small> : <small>Hold Ctrl or Cmd to choose multiple approvers for the same step.</small>}
                        </label>
                      </article>
                    ))}
                  </div>

                  <div className="action-button-row">
                    <button className="ghost-button" type="button" onClick={() => setWorkflowForm((current) => ({ ...current, steps: [...current.steps, createEmptyWorkflowStep()] }))}>Add step</button>
                    <button className="primary-button" type="submit" disabled={isSavingWorkflow}>{isSavingWorkflow ? "Saving workflow..." : "Save workflow"}</button>
                  </div>
                </form>
              )}
            </section>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="hero-panel">
        <p className="eyebrow">Reimbursement Management</p>
        <h1>Build the reimbursement flow from the company level, not from a loose set of forms.</h1>
        <p className="hero-copy">
          This application uses live country and currency data, local PostgreSQL-backed state, role-aware
          approvals, and a clean white, sky-blue, and red interface that stays focused on business use.
        </p>

        <div className="hero-grid">
          <article className="hero-card">
            <span className="hero-card-title">What is inside</span>
            <ul>
              <li>Company-aware onboarding with base currency selection</li>
              <li>Admin user and reporting-manager setup</li>
              <li>Expense drafting, submission, and status history</li>
              <li>Sequential and conditional approval workflow support</li>
            </ul>
          </article>
          <article className="hero-card hero-card-accent">
            <span className="hero-card-title">Judging-aligned choices</span>
            <ul>
              <li>PostgreSQL and Prisma instead of backend-as-a-service shortcuts</li>
              <li>Dynamic country and exchange-rate data with local caching</li>
              <li>Role-based validation and guarded approval actions</li>
              <li>Responsive UI with controlled animation and consistent spacing</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-header">
          <div><p className="eyebrow">Get Started</p><h2>{mode === "signup" ? "Create company workspace" : "Sign in to continue"}</h2></div>
          <div className="mode-switch">
            <button className={mode === "signup" ? "mode-button is-active" : "mode-button"} type="button" onClick={() => { setMode("signup"); setAuthFieldErrors({}); setAuthError(""); }}>Signup</button>
            <button className={mode === "login" ? "mode-button is-active" : "mode-button"} type="button" onClick={() => { setMode("login"); setAuthFieldErrors({}); setAuthError(""); }}>Login</button>
          </div>
        </div>

        {countriesError ? (
          <div className="alert-box"><strong>Country data is unavailable right now.</strong><p>{countriesError}</p><button className="ghost-button" type="button" onClick={() => void loadCountries(true)}>Retry</button></div>
        ) : null}
        {authError ? (
          <div className="alert-box alert-box-danger"><strong>Request could not be completed.</strong><p>{authError}</p></div>
        ) : null}

        {mode === "signup" ? (
          <form className="auth-form" onSubmit={(event) => void handleSignupSubmit(event)}>
            <label className="field">
              <span>Company name</span>
              <input value={signupForm.companyName} onChange={(event) => setSignupForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Acme Labs" />
              {authFieldErrors.companyName ? <small>{authFieldErrors.companyName}</small> : null}
            </label>
            <div className="field-row">
              <label className="field">
                <span>First name</span>
                <input value={signupForm.firstName} onChange={(event) => setSignupForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="Vineet" />
                {authFieldErrors.firstName ? <small>{authFieldErrors.firstName}</small> : null}
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={signupForm.lastName} onChange={(event) => setSignupForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Unde" />
                {authFieldErrors.lastName ? <small>{authFieldErrors.lastName}</small> : null}
              </label>
            </div>
            <label className="field">
              <span>Email</span>
              <input type="email" value={signupForm.email} onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))} placeholder="admin@acmelabs.com" />
              {authFieldErrors.email ? <small>{authFieldErrors.email}</small> : null}
            </label>
            <div className="field-row field-row-country">
              <label className="field">
                <span>Country</span>
                <select value={signupForm.countryCode} onChange={(event) => setSignupForm((current) => ({ ...current, countryCode: event.target.value }))} disabled={countriesLoading}>
                  <option value="">{countriesLoading ? "Loading countries..." : "Select country"}</option>
                  {countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.countryName} ({country.currencyCode})</option>)}
                </select>
                {authFieldErrors.countryCode ? <small>{authFieldErrors.countryCode}</small> : null}
              </label>
              <div className="currency-preview">
                <span className="currency-label">Base currency</span>
                <strong>{selectedCountry ? selectedCountry.currencyCode : "Waiting for selection"}</strong>
                <p>{selectedCountry ? `${selectedCountry.currencyName ?? "Currency"}${selectedCountry.currencySymbol ? ` | ${selectedCountry.currencySymbol}` : ""}` : "The selected country sets your company currency."}</p>
              </div>
            </div>
            <label className="field">
              <span>Password</span>
              <input type="password" value={signupForm.password} onChange={(event) => setSignupForm((current) => ({ ...current, password: event.target.value }))} placeholder="Use uppercase, lowercase, and a number" />
              {authFieldErrors.password ? <small>{authFieldErrors.password}</small> : null}
            </label>
            <button className="primary-button" type="submit" disabled={isSubmittingAuth || countriesLoading}>{isSubmittingAuth ? "Creating workspace..." : "Create workspace"}</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => void handleLoginSubmit(event)}>
            <label className="field">
              <span>Email</span>
              <input type="email" value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} placeholder="admin@acmelabs.com" />
              {authFieldErrors.email ? <small>{authFieldErrors.email}</small> : null}
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} placeholder="Enter your password" />
              {authFieldErrors.password ? <small>{authFieldErrors.password}</small> : null}
            </label>
            <button className="primary-button" type="submit" disabled={isSubmittingAuth}>{isSubmittingAuth ? "Signing in..." : "Sign in"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
