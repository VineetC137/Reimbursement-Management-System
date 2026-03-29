# Architecture Notes

## 1. System Shape
The product should be built as a standard three-layer web application:

- React frontend for user-facing workflows
- Express API for business logic and orchestration
- PostgreSQL for durable relational storage

This is the right fit because the main complexity is in approval rules, data relationships, audit history, and validation. Those are easier to model and explain in a conventional layered system than in a serverless or BaaS-heavy stack.

## 2. Main Architectural Boundaries

### Frontend
The frontend should be responsible for:

- authentication screens
- dashboard layout and navigation
- expense submission forms
- approval queue tables
- approval rule management screens
- status timeline views
- optimistic but safe UI updates
- client-side validation for fast feedback

The frontend should not contain approval rule logic beyond display and simple derived UI state. Final approval decisions must always be computed on the server.

### Backend API
The API layer should handle:

- authentication and token issuance
- company onboarding
- role enforcement
- employee-manager mapping
- expense creation and status updates
- rule evaluation
- approval progression
- currency normalization
- audit logging
- notification event creation

The backend is where the domain logic lives. That keeps behavior consistent even if the UI changes later.

### Database
PostgreSQL is the source of truth for:

- company and user identity
- approval rules and rule snapshots
- expenses and attachments
- approval actions and outcomes
- cached country/currency data
- exchange-rate snapshots
- audit history
- notification state

## 3. Module Breakdown

### Auth and Onboarding Module
Responsibilities:

- register first admin user
- create company during signup
- map selected country to base currency
- hash passwords
- issue JWT access tokens
- protect routes by role

Key rule:

- onboarding is a single transaction from the system point of view; partial creation should be rolled back if any step fails

### User Management Module
Responsibilities:

- create employees and managers
- assign and update roles
- activate or deactivate users
- define reporting manager relationships

Key rule:

- role changes should not silently invalidate in-flight approval instances; any effect on active approvals must be explicit

### Expense Module
Responsibilities:

- create draft expense
- attach receipt metadata
- validate amount, date, currency, and category
- submit expense for approval
- show employee expense history

Key rule:

- once submitted, the server should create approval instances using a snapshot of the currently applicable rule

### Approval Engine Module
Responsibilities:

- resolve which rule applies to the expense
- include manager-first logic when enabled
- generate approval steps or approval pool participants
- evaluate percentage and specific-approver conditions
- move to next step when sequential logic is used
- finalize approved or rejected state

Key rule:

- rule evaluation must be deterministic and replayable from stored records

### Currency Module
Responsibilities:

- fetch country/currency mappings
- fetch exchange rates
- cache external data locally
- normalize submitted expense amounts into company base currency

Key rule:

- the system must never depend on live external APIs at the exact moment a manager reviews an expense; normalized values should already be stored

### Audit and Notification Module
Responsibilities:

- store user actions for traceability
- record approval and override remarks
- generate notification records for next approver or requester

Key rule:

- major state transitions must be auditable without relying on log files alone

## 4. Request Flow

### Signup Flow
1. User submits company name, admin details, password, and selected country.
2. Backend validates email, password, and country selection.
3. Backend fetches or reads cached country-currency mapping.
4. Backend creates the company, admin user, and base role links in one transaction.
5. JWT is returned to the client.

### Expense Submission Flow
1. Employee creates an expense draft.
2. Backend validates inputs and normalizes currency amount.
3. Employee submits the draft.
4. Backend resolves the active rule and stores a rule snapshot reference.
5. Backend creates approval instances and the first actionable approval step.
6. Notifications are created for the first approver or approval group.

### Approval Action Flow
1. Approver opens their queue.
2. Approver approves or rejects with comments.
3. Backend records the approval action in an immutable log.
4. Approval engine reevaluates the state using the rule snapshot.
5. If conditions are met, the expense is approved or rejected.
6. Otherwise, the next approver step becomes active.

## 5. Local-First Reliability Strategy
The project should use dynamic external data, but it should not become fragile because of that.

### Country and Currency Data
- pull from the Rest Countries API
- store normalized country and currency mappings locally
- refresh on schedule or admin-triggered action
- use cache when remote fetch fails

### Exchange Rates
- pull from the exchange-rate API
- store rates with base currency and fetched timestamp
- use TTL-based refresh
- preserve last known valid rate for fallback scenarios

### Why This Matters
This approach satisfies the "dynamic data" requirement without introducing production-style fragility into a student project demo.

## 6. Security and Validation

### Authentication
- bcrypt for password hashing
- JWT access tokens
- middleware-based route protection
- role checks at controller or service boundary

### Validation
- request schema validation at API boundary
- database constraints for critical integrity checks
- consistent error response shape
- frontend validation for immediate user feedback

### Access Control
- employees can only access their own expenses
- managers can access reviewable team expenses
- admins can access company-wide data and override actions

## 7. Error-Handling Strategy
Use predictable, user-friendly failure handling.

- 400 for validation errors
- 401 for unauthenticated requests
- 403 for unauthorized actions
- 404 for missing records
- 409 for state conflicts such as approving an already-decided item
- 500 only for unexpected server failures

Recommended error shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Enter a valid email address"
  }
}
```

## 8. Proposed Backend Service Split
- `authService`
- `companyService`
- `userService`
- `expenseService`
- `approvalRuleService`
- `approvalEngineService`
- `currencyService`
- `auditService`
- `notificationService`

This keeps controller code thin and makes the core logic easier to test.

## 9. Frontend Screen Map
- Signup
- Login
- Admin dashboard
- User management
- Approval rule management
- Employee expense list
- Employee create expense
- Expense detail with timeline
- Manager approval queue
- Manager expense detail
- Admin expense oversight

## 10. Future Extensions
The architecture should leave room for:

- OCR receipt parsing
- email notifications
- in-app notification center
- export to CSV or PDF
- department or cost-center level approval rules
- analytics dashboard

OCR belongs in a separate module so the core domain stays stable even if OCR confidence rules change later.
