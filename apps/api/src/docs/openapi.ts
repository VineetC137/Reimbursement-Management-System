import { env } from "../config/env.js";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Reimbursement Management API",
    version: "1.0.0",
    description:
      "REST API for company onboarding, expense submission, configurable approval workflows, notifications, OCR-assisted receipts, and reporting exports."
  },
  servers: [
    {
      url: `${env.publicApiBaseUrl}/api/v1`,
      description: "Local development server"
    }
  ],
  tags: [
    { name: "Auth" },
    { name: "Metadata" },
    { name: "Users" },
    { name: "Expenses" },
    { name: "Workflows" },
    { name: "Notifications" },
    { name: "Reports" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object", additionalProperties: { type: "string" } }
            }
          }
        }
      },
      SuccessEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { type: "object", additionalProperties: true }
        }
      }
    }
  },
  paths: {
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create a company and the initial admin account"
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate an existing user"
      }
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Return the current session context",
        security: [{ bearerAuth: [] }]
      }
    },
    "/metadata/countries": {
      get: {
        tags: ["Metadata"],
        summary: "Fetch cached country and base-currency options"
      }
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List company users",
        security: [{ bearerAuth: [] }]
      },
      post: {
        tags: ["Users"],
        summary: "Create an employee or manager",
        security: [{ bearerAuth: [] }]
      }
    },
    "/users/{userId}/role": {
      patch: {
        tags: ["Users"],
        summary: "Change a user's role",
        security: [{ bearerAuth: [] }]
      }
    },
    "/users/{userId}/manager": {
      post: {
        tags: ["Users"],
        summary: "Assign or update the reporting manager",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/categories": {
      get: {
        tags: ["Expenses"],
        summary: "List active expense categories",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses visible to the current user",
        security: [{ bearerAuth: [] }]
      },
      post: {
        tags: ["Expenses"],
        summary: "Create an expense draft",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/{expenseId}": {
      get: {
        tags: ["Expenses"],
        summary: "Fetch one expense in detail",
        security: [{ bearerAuth: [] }]
      },
      patch: {
        tags: ["Expenses"],
        summary: "Update an existing expense draft",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/{expenseId}/submit": {
      post: {
        tags: ["Expenses"],
        summary: "Submit a draft into the approval workflow",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/{expenseId}/action": {
      post: {
        tags: ["Expenses"],
        summary: "Approve or reject an expense in the current stage",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/{expenseId}/override": {
      post: {
        tags: ["Expenses"],
        summary: "Admin override for final approval or rejection",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/{expenseId}/receipt": {
      post: {
        tags: ["Expenses"],
        summary: "Upload a receipt file and trigger OCR extraction",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  receipt: {
                    type: "string",
                    format: "binary"
                  }
                },
                required: ["receipt"]
              }
            }
          }
        }
      }
    },
    "/expenses/{expenseId}/receipt/apply-ocr": {
      post: {
        tags: ["Expenses"],
        summary: "Apply OCR-extracted fields back onto a draft expense",
        security: [{ bearerAuth: [] }]
      }
    },
    "/expenses/queue": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses currently waiting for the logged-in approver",
        security: [{ bearerAuth: [] }]
      }
    },
    "/workflows/default": {
      get: {
        tags: ["Workflows"],
        summary: "Fetch default workflow settings",
        security: [{ bearerAuth: [] }]
      },
      put: {
        tags: ["Workflows"],
        summary: "Update the default workflow settings",
        security: [{ bearerAuth: [] }]
      }
    },
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List in-app notifications for the current user",
        security: [{ bearerAuth: [] }]
      }
    },
    "/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        security: [{ bearerAuth: [] }]
      }
    },
    "/notifications/{notificationId}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark one notification as read",
        security: [{ bearerAuth: [] }]
      }
    },
    "/reports/dashboard": {
      get: {
        tags: ["Reports"],
        summary: "High-level dashboard metrics for managers and admins",
        security: [{ bearerAuth: [] }]
      }
    },
    "/reports/pending-by-approver": {
      get: {
        tags: ["Reports"],
        summary: "Current queue load grouped by approver",
        security: [{ bearerAuth: [] }]
      }
    },
    "/reports/rejections": {
      get: {
        tags: ["Reports"],
        summary: "Recent rejected expenses",
        security: [{ bearerAuth: [] }]
      }
    },
    "/reports/aging": {
      get: {
        tags: ["Reports"],
        summary: "Aging report for in-review expenses",
        security: [{ bearerAuth: [] }]
      }
    },
    "/reports/export": {
      get: {
        tags: ["Reports"],
        summary: "Export a report as CSV",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "type",
            schema: {
              type: "string",
              enum: ["dashboard", "pending-by-approver", "rejections", "aging"]
            },
            required: true
          }
        ]
      }
    }
  }
} as const;
