# API Specification

## 1. API Style
- REST API
- base path: `/api/v1`
- JSON request and response format
- JWT bearer token authentication for protected routes

Recommended common response shape:

```json
{
  "success": true,
  "message": "Expense submitted successfully",
  "data": {}
}
```

Validation failure shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "amount": "Amount must be greater than zero"
  }
}
```

## 2. Authentication and Onboarding

### `POST /auth/signup`
Creates the first company and admin user.

Request body:

```json
{
  "companyName": "Acme Labs",
  "countryCode": "IN",
  "firstName": "Vineet",
  "lastName": "Unde",
  "email": "admin@acmelabs.com",
  "password": "StrongPassword123!"
}
```

Validation:

- company name required, 3 to 150 characters
- valid country code required
- valid email required
- password must satisfy minimum strength rule

Response data:

- company summary
- user summary
- JWT token

### `POST /auth/login`
Logs an existing user in.

Request body:

```json
{
  "email": "admin@acmelabs.com",
  "password": "StrongPassword123!"
}
```

Response data:

- JWT token
- current user info
- company info

### `GET /auth/me`
Returns current authenticated user and company context.

Authorization:

- any authenticated user

## 3. Country and Currency Metadata

### `GET /metadata/countries`
Returns country list with currency information from local cache.

Query params:

- `refresh=true` optional for admin-triggered refresh

Behavior:

- return cached records by default
- refresh from remote source only when stale or explicitly requested

### `GET /metadata/exchange-rates`
Returns cached exchange rates for a base currency.

Query params:

- `baseCurrency=INR`

Response data:

- base currency
- fetched timestamp
- list of target currencies and rates

## 4. User and Role Management

### `POST /users`
Create an employee or manager under the authenticated admin's company.

Authorization:

- admin only

Request body:

```json
{
  "firstName": "Asad",
  "lastName": "Pathan",
  "email": "asad@acmelabs.com",
  "roleCode": "MANAGER",
  "jobTitle": "Operations Manager",
  "department": "Operations"
}
```

Validation:

- email unique within company
- role must be one of allowed values

### `GET /users`
List company users.

Authorization:

- admin only

Query params:

- `roleCode`
- `isActive`
- `search`

### `PATCH /users/:userId/role`
Change a user's role.

Authorization:

- admin only

Request body:

```json
{
  "roleCode": "EMPLOYEE"
}
```

### `POST /users/:userId/manager`
Assign or update reporting manager.

Authorization:

- admin only

Request body:

```json
{
  "managerUserId": "uuid",
  "startsAt": "2026-04-01"
}
```

Validation:

- employee and manager must belong to same company
- user cannot be their own manager

### `GET /users/:userId/manager-history`
Returns reporting history for a user.

Authorization:

- admin or the user themselves

## 5. Expense Endpoints

### `POST /expenses`
Create a draft expense.

Authorization:

- employee

Request body:

```json
{
  "title": "Client lunch",
  "categoryId": "uuid",
  "description": "Lunch meeting with vendor",
  "expenseDate": "2026-03-20",
  "originalAmount": 1850,
  "originalCurrencyCode": "INR"
}
```

Behavior:

- validate date and amount
- read exchange rate
- calculate and store company normalized amount
- create draft status

### `GET /expenses`
Returns expense list for current user or wider scope depending on role.

Authorization:

- employee: own expenses only
- manager: own submitted items and optional team view
- admin: company-wide access

Query params:

- `status`
- `fromDate`
- `toDate`
- `categoryId`
- `search`
- `page`
- `limit`

### `GET /expenses/:expenseId`
Returns expense detail, attachments, approval timeline, and audit summary.

Authorization:

- access controlled by role and company ownership

### `PATCH /expenses/:expenseId`
Update a draft expense.

Authorization:

- employee who owns the draft

Rules:

- only allowed for `DRAFT` status

### `POST /expenses/:expenseId/submit`
Submits draft for approval.

Authorization:

- employee who owns the draft

Behavior:

- validates that required fields exist
- resolves approval rule
- creates rule snapshot
- creates approval instances
- updates expense status to `SUBMITTED` or `IN_REVIEW`

### `POST /expenses/:expenseId/receipts`
Upload receipt file metadata and storage mapping.

Authorization:

- employee who owns the expense

Rules:

- validate file size and type
- store metadata in `expense_receipts`

### `POST /expenses/:expenseId/attachments`
Upload other supporting documents.

Authorization:

- employee who owns the expense

## 6. Approval Queue and Actions

### `GET /approvals/queue`
Returns pending approval items for the current approver.

Authorization:

- manager or admin

Query params:

- `status`
- `categoryId`
- `fromDate`
- `toDate`

Response fields:

- expense summary
- employee info
- original amount and currency
- company amount and currency
- active step info
- whether current user is decisive approver

### `GET /approvals/:instanceId`
Returns approval instance detail for one queue item.

Authorization:

- assigned approver or admin

### `POST /approvals/:instanceId/approve`
Approve the current approval instance.

Authorization:

- assigned approver or admin override path if policy allows

Request body:

```json
{
  "comment": "Looks fine from finance side"
}
```

Behavior:

- save approval action
- update instance status
- reevaluate approval rule conditions
- activate next step or finalize expense

### `POST /approvals/:instanceId/reject`
Reject the current approval instance.

Authorization:

- assigned approver or admin

Request body:

```json
{
  "comment": "Receipt is missing tax details"
}
```

Rules:

- rejection comment should be mandatory

### `GET /approvals/history/:expenseId`
Returns all approval actions for an expense in chronological order.

Authorization:

- employee owner, assigned approvers, or admin

## 7. Approval Rule Management

### `POST /approval-rules`
Create a new approval rule.

Authorization:

- admin only

Request body:

```json
{
  "name": "Miscellaneous expense approval",
  "description": "Used for medium-value miscellaneous expenses",
  "categoryId": "uuid",
  "minAmountCompany": 1000,
  "maxAmountCompany": 25000,
  "isManagerApprover": true,
  "sequenceRequired": true,
  "decisionMode": "HYBRID",
  "minimumApprovalPercentage": 60,
  "specificApproverUserId": "uuid",
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "MANAGER",
      "isRequired": true
    },
    {
      "stepOrder": 2,
      "stepType": "USER",
      "approverUserId": "uuid",
      "isRequired": true
    },
    {
      "stepOrder": 3,
      "stepType": "USER",
      "approverUserId": "uuid",
      "isRequired": false
    }
  ],
  "conditions": [
    {
      "conditionType": "MIN_PERCENTAGE",
      "thresholdPercentage": 60
    },
    {
      "conditionType": "SPECIFIC_APPROVER",
      "specificApproverUserId": "uuid"
    }
  ]
}
```

Validation:

- min amount cannot exceed max amount
- percentage must be between 0 and 100
- specific approver must belong to same company
- steps must have unique order
- hybrid configuration cannot be structurally contradictory

### `GET /approval-rules`
List approval rules for current company.

Authorization:

- admin only

### `GET /approval-rules/:ruleId`
Return one rule with steps and conditions.

Authorization:

- admin only

### `PATCH /approval-rules/:ruleId`
Update a rule for future expenses.

Authorization:

- admin only

Important behavior:

- existing submitted expenses continue using snapshots created earlier

### `PATCH /approval-rules/:ruleId/status`
Activate or deactivate a rule.

Authorization:

- admin only

## 8. Admin Oversight and Override

### `GET /admin/expenses`
Company-wide expense list.

Authorization:

- admin only

Query params:

- `status`
- `employeeUserId`
- `categoryId`
- `fromDate`
- `toDate`

### `POST /admin/expenses/:expenseId/override`
Allows admin to override current approval outcome.

Authorization:

- admin only

Request body:

```json
{
  "action": "OVERRIDE_APPROVE",
  "comment": "Approved after manual verification by finance"
}
```

Rules:

- override comment required
- override must create audit log and approval action record

## 9. Notifications and Activity

### `GET /notifications`
Returns current user's notifications.

Authorization:

- any authenticated user

### `PATCH /notifications/:notificationId/read`
Marks one notification as read.

Authorization:

- notification owner only

### `GET /audit-logs`
Returns audit records for admin review.

Authorization:

- admin only

Query params:

- `entityType`
- `entityId`
- `actorUserId`
- `fromDate`
- `toDate`

## 10. Suggested HTTP Status Usage
- `200` successful read or update
- `201` created
- `204` optional for empty successful update
- `400` validation failure
- `401` unauthenticated
- `403` forbidden
- `404` record not found
- `409` invalid state transition
- `422` semantically invalid business rule payload if team prefers this over `400`
- `500` unexpected error

## 11. Validation Rules That Must Exist
- email format validation
- password length and strength validation
- positive amount validation
- valid ISO currency code validation
- file type and size validation
- duplicate active manager relation prevention
- invalid approval rule combination prevention
- same-company ownership checks

## 12. Testing Priority by Endpoint Group
Highest priority areas:

- `/auth/signup`
- `/expenses/:expenseId/submit`
- `/approvals/:instanceId/approve`
- `/approvals/:instanceId/reject`
- `/approval-rules`
- `/admin/expenses/:expenseId/override`

These routes contain the core business logic and should get the strongest integration coverage.
