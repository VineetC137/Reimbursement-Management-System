# API Specification

Base path: `/api/v1`

## Auth
- `POST /auth/register-company-admin`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

## Companies
- `GET /companies/me`
- `PATCH /companies/me`
- `GET /companies/countries-currencies`

## Users
- `POST /users`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/:id/roles`
- `PATCH /users/:id/manager`

## Expenses
- `POST /expenses`
- `GET /expenses`
- `GET /expenses/:id`
- `PATCH /expenses/:id`
- `POST /expenses/:id/submit`
- `POST /expenses/:id/receipts`
- `POST /expenses/ocr-extract`

## Workflows
- `POST /workflows`
- `GET /workflows`
- `GET /workflows/:id`
- `PATCH /workflows/:id`
- `POST /workflows/:id/steps`
- `POST /workflows/:id/rules`

## Approvals
- `GET /approvals/queue`
- `GET /approvals/instances/:id`
- `POST /approvals/instances/:id/actions`
- `POST /approvals/instances/:id/override`

## Reports
- `GET /reports/dashboard`
- `GET /reports/aging`
- `GET /reports/pending-by-approver`
- `GET /reports/rejections`

## Response Contracts
- Standard envelope: `{ success, data, error, meta }`
- Error object: `{ code, message, details? }`
- Pagination meta: `{ page, pageSize, total, totalPages }`

## OpenAPI
- Swagger doc endpoint: `/api/v1/docs`
