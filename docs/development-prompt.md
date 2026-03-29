# Master Development Prompt

Use the following prompt when starting the actual implementation. It is intentionally detailed so the build stays aligned with the project requirements, judging expectations, and team style.

---

You are building a full-stack project called **Reimbursement Management** for a student engineering team. Build it like a serious internal company product, not like a hackathon demo and not like a generated dashboard template.

## Product Goal
Create a reimbursement management system that solves manual expense approval problems inside a company. The application must support:

- company onboarding on first signup
- admin, manager, and employee roles
- employee expense submission in multiple currencies
- manager and multi-step approval workflows
- conditional approval rules
- strong validation
- local PostgreSQL database
- responsive and clean UI
- traceable audit history

## Important Constraints
- Do not use Firebase, Supabase, MongoDB Atlas, or any backend-as-a-service platform.
- Use PostgreSQL locally.
- Use dynamic data sources for country/currency and exchange rates.
- Do not use static JSON in the final implementation except temporary prototyping or seeding.
- Minimize third-party dependencies. Only use libraries that add clear value.
- Do not blindly paste AI code. Everything added must be understandable, adaptable, and coherent with the project.
- OCR is a planned Phase 2 feature. Do not let it delay the core delivery.
- Work directly on `main` and create clean milestone commits throughout development.

## Required Stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT + bcrypt

## Expected Repository Structure
Create a clean structure like this:

```text
/
|-- client/
|   |-- src/
|   |   |-- app/
|   |   |-- components/
|   |   |-- features/
|   |   |-- layouts/
|   |   |-- pages/
|   |   |-- services/
|   |   |-- styles/
|   |   |-- types/
|-- server/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- modules/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- validations/
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|-- docs/
|-- uploads/
|-- .env.example
```

## Functional Requirements

### 1. Authentication and First Signup
- The first signup creates a company and its initial admin.
- The signup form must ask for company name, country, first name, last name, email, and password.
- The selected country sets the company's base currency.
- Country and currency list must come from dynamic API data, cached locally.
- Passwords must be hashed.
- JWT authentication must protect private routes.

### 2. User and Role Management
- Admin can create employees and managers.
- Admin can change user roles.
- Admin can assign employees to managers.
- Users should belong to a company and all access must stay company-scoped.

### 3. Expense Submission
- Employees can create draft expenses.
- Fields must include:
  - title
  - category
  - description
  - expense date
  - original amount
  - original currency
  - attachments or receipts
- The backend must calculate the amount in the company currency using cached exchange rates.
- Employees must be able to view their expense history and full status.

### 4. Approval Workflow
- Support manager-first logic if enabled in the rule.
- Support multiple approvers in sequence.
- The next approver should become active only after the current one approves or rejects.
- Approvers must be able to approve or reject with comments.
- Managers must see reviewable items in a dedicated approval queue.
- Admin must be able to see all expenses and override decisions with audit comments.

### 5. Conditional Rules
Approval rules must support:

- percentage-based approval, for example 60 percent approval required
- specific approver approval, for example CFO approval auto-approves
- hybrid logic, for example 60 percent approval or CFO approval
- combination of sequence plus conditional rules

### 6. OCR Receipt Parsing
- Keep OCR out of the first core release.
- Prepare the database and file-handling design so OCR can be added later.
- If you add placeholders, they must be clearly isolated and not interfere with the main flow.

## Non-Functional Requirements

### Database
- Treat database design as a first-class concern.
- Use proper foreign keys, indexes, constraints, and timestamps.
- Store both original amount and normalized company amount.
- Use snapshot records for approval rules so in-flight expenses are not broken by later admin edits.
- Record approval actions immutably.

### Validation
- Validate on both frontend and backend.
- Return clear field-level messages for invalid email, weak password, invalid amount, invalid date, or invalid rule configuration.
- Do not allow invalid workflow states.

### Reliability
- Use external APIs for country/currency and exchange rates, but store a local cache.
- If external APIs fail, the app should fall back to the latest valid cache.
- Never block a manager review because an exchange-rate API is temporarily unavailable at runtime.

### Security
- Use JWT auth and route guards.
- Restrict employee, manager, and admin access correctly.
- Do not expose other company data across tenants.

### UI and UX
- The interface must be responsive and clean.
- Use mainly white and sky blue, with some red for destructive, warning, or rejection states.
- The UI should be slightly animated with subtle transitions.
- Avoid dark generic admin themes, overly flashy gradients, and emoji-heavy design.
- Use intuitive navigation with proper spacing.
- Make the layout feel custom to this project, not copied from a common dashboard template.

## UI Direction

### Visual Tone
- professional
- clean
- light
- business-ready
- slightly animated

### Color Guidance
- background: very light white-blue
- primary: sky blue
- accent: red only where needed
- text: dark slate blue

### Layout Guidance
- left sidebar for navigation
- top bar for user and company context
- cards and tables with comfortable spacing
- mobile-friendly fallback for tables

### Animation Guidance
- soft hover states
- smooth section transitions
- no dramatic or distracting motion

## Exact Data Model Expectations
Design the PostgreSQL schema around these tables:

- `companies`
- `roles`
- `users`
- `employee_manager_relations`
- `expense_categories`
- `expenses`
- `expense_receipts`
- `expense_attachments`
- `approval_rules`
- `approval_rule_steps`
- `approval_conditions`
- `approval_rule_snapshots`
- `approval_rule_snapshot_steps`
- `expense_approval_instances`
- `expense_approval_actions`
- `currency_rates`
- `country_currency_cache`
- `audit_logs`
- `notifications`

The data model must support:

- multi-tenant company isolation
- approval sequence and conditional logic
- manager-first approval
- expense-level snapshotting of approval rules
- audit history
- notification tracking

## API Requirements
Build REST endpoints for:

- auth signup and login
- current user session
- country/currency metadata
- exchange-rate metadata
- user creation and role changes
- manager assignment
- expense draft creation
- expense submission
- expense history and detail view
- receipt and attachment upload
- approval queue
- approve or reject action
- approval history
- rule creation, update, activation, and listing
- admin expense oversight
- admin approval override
- notifications and audit logs

Keep controllers thin and move real logic into services or modules.

## Suggested Backend Modules
- auth module
- company module
- user module
- expense module
- approval rule module
- approval engine module
- currency module
- notification module
- audit module

## Suggested Frontend Screens
- signup
- login
- employee dashboard
- my expenses
- create expense
- expense detail with timeline
- manager approval queue
- manager approval detail
- admin dashboard
- user management
- approval rule management
- all expenses view
- audit log view

## Suggested Build Order
Follow this implementation order and commit after each stable checkpoint.

### Milestone 1
- initialize React, Express, Prisma, and PostgreSQL integration
- configure environment variables
- create base folder structure
- create roles seed

Commit message:

```text
chore: initialize frontend, backend, prisma, and local postgres setup
```

### Milestone 2
- implement Prisma schema for company, roles, users, manager mapping, and base metadata
- run first migrations
- seed roles and categories

Commit message:

```text
feat: add core company, user, and role database schema
```

### Milestone 3
- build signup and login APIs
- create first company and admin flow
- connect frontend auth screens

Commit message:

```text
feat: implement company onboarding and authentication flow
```

### Milestone 4
- build admin user management and manager assignment
- add admin UI screens

Commit message:

```text
feat: add user management and reporting manager configuration
```

### Milestone 5
- build expense draft, submission, currency normalization, and expense history
- add employee UI

Commit message:

```text
feat: implement expense submission and employee expense tracking
```

### Milestone 6
- implement approval rule CRUD
- add sequential and conditional approval engine
- create queue for managers and approvers

Commit message:

```text
feat: add approval rules and multi-step approval workflow
```

### Milestone 7
- add audit logs, notifications, admin overrides, and UI polish
- refine validation and edge cases

Commit message:

```text
feat: add audit trail, notifications, and admin override flow
```

### Milestone 8
- test responsive behavior
- improve empty states, loaders, and errors
- clean up UI consistency

Commit message:

```text
style: refine responsive UI, spacing, and state feedback
```

## Implementation Standards
- do not keep business logic in route files
- do not mix unrelated responsibilities in large components
- use reusable validation schemas
- prefer readable naming over short clever naming
- log important server failures in a structured way
- keep API responses consistent
- keep UI spacing and color usage consistent

## Testing Expectations
At minimum, verify these flows:

### Auth
- first signup creates company and admin
- invalid email is rejected
- weak password is rejected

### User Management
- admin can create manager and employee
- employee cannot access admin endpoints
- invalid manager assignment is blocked

### Expense
- employee can save draft
- employee can submit expense in non-base currency
- converted amount is stored correctly
- invalid amount or invalid date is rejected

### Approval
- sequential approval activates next step correctly
- manager-first works only when enabled
- percentage rule resolves correctly
- specific approver can auto-approve when configured
- hybrid rule resolves correctly
- rejection requires comment

### Reliability
- app still works using cached data if external APIs fail

### UI
- mobile layout remains usable
- tables remain readable
- form validation appears clearly

## What to Avoid
- do not use MongoDB for this project
- do not use backend-as-a-service platforms
- do not create a generic analytics-heavy dashboard just to fill space
- do not bury important actions behind too many clicks
- do not rely on static JSON for final app data
- do not skip commit checkpoints
- do not add fancy technology only for appearance

## Final Tone Requirement
The finished project should feel like it was built by a capable engineering team that understood the domain and made deliberate technical choices. It should not feel auto-generated, over-marketed, or copied from a generic admin template.

Build it in a way that the team can confidently explain:

- why the database is designed this way
- how approval rules work
- how currency normalization works
- why PostgreSQL was chosen
- how the UI supports the workflows
- how each team member contributed

---

If code already exists, extend it carefully instead of rewriting everything. If the codebase is empty, scaffold it cleanly and follow the build order above.
