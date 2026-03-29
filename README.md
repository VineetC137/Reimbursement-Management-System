# Reimbursement Management

Reimbursement Management is a full-stack system for handling employee expense claims without relying on spreadsheets, email chains, or manual status tracking. The project is designed around configurable approval logic, strong relational modeling, dynamic currency data, and a UI that feels clean and reliable enough for a real internal workflow.

This repository now contains both:

- an initial application scaffold under `apps/api` and `apps/web`
- a detailed repo kit in `docs/` to guide the actual build, review, and presentation

## Why This Project Matters
Manual reimbursement processes usually fail in predictable ways:

- approvals are handled inconsistently across teams
- there is no clear visibility into who approved what
- multi-step approvals are difficult to track
- expenses may be submitted in one currency and reviewed in another
- admins cannot easily audit or override decisions

The goal of this project is to solve those problems with a database-first, workflow-driven system that the team can explain confidently during evaluation.

## What the Judges Care About
This repo is organized around the strongest judging criteria:

- database design and relational thinking
- modular architecture and clear technical choices
- dynamic data instead of static JSON
- strong validation and graceful error handling
- clean, responsive UI
- visible team contribution through Git history

## Recommended Stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Validation: schema-driven request validation
- Authentication: JWT + bcrypt
- OCR: planned for Phase 2, not a blocker for the core release

## Core Product Scope

### Authentication and Company Onboarding
- first signup creates the company and the initial admin user
- selected country determines the company base currency
- country and currency data is fetched dynamically and cached locally

### User and Role Management
- admin can create employees and managers
- admin can change roles
- admin can assign reporting managers
- access remains scoped to company data

### Expense Submission
- employees can create draft expenses
- claims store original amount and original currency
- the backend also stores normalized company-currency amount
- employees can view full expense history and status

### Approval Workflow
- sequential approval flow is supported
- manager-first approval can be enabled
- approvers can approve or reject with comments
- admin can override with audit remarks

### Notifications and Reporting
- in-app notifications show stage changes, approval requests, and final outcomes
- managers and admins can review aging approvals, rejection history, and queue load
- reports stay scoped to the current company and role visibility rules

### Conditional Approval Rules
- percentage approval rules
- specific approver rules
- hybrid approval rules
- combination of sequential and conditional logic

## Approval Flow Examples

### Sequential Flow
- Step 1: Reporting Manager
- Step 2: Finance Reviewer
- Step 3: Director

The next step activates only after the current one is completed.

### Percentage Rule
- five approvers assigned
- threshold: 60 percent approval required

If three of the five approve, the expense can be finalized unless a stronger rule overrides it.

### Specific Approver Rule
- CFO marked as decisive approver
- if CFO approves, the expense is auto-approved

### Hybrid Rule
- manager-first enabled
- finance and director steps present
- final decision rule: 60 percent approval or CFO approval

## Role Capabilities
- Admin: company setup, user management, approval rule configuration, override actions, audit visibility
- Manager: approval queue, team expense visibility, approve or reject with comments
- Employee: submit expenses, upload receipts, track timeline and current status

## Dynamic Integrations
- country and currency mapping: `https://restcountries.com/v3.1/all?fields=name,currencies`
- exchange rates: `https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}`

Required runtime behavior:

- use live data when possible
- cache results locally in PostgreSQL
- fall back to last valid cache when external providers fail
- surface a safe warning instead of breaking the flow

## UI Direction
The UI should feel like a serious business product rather than a generic dashboard template.

- main colors: white and sky blue
- red used only for warnings, rejection, and destructive actions
- clean spacing and intuitive navigation
- subtle animation only where it improves clarity
- no emoji-heavy interface
- no dark neon dashboard styling

## Repository Structure
```text
reimbursement-management-system/
  apps/
    api/
      prisma/
      src/
    web/
      src/
  docs/
    API_SPEC.md
    DATABASE_SCHEMA.md
    GIT_WORKFLOW.md
    IMPLEMENTATION_BLUEPRINT.md
    PRESENTATION_CHECKLIST.md
    ROADMAP.md
    SYSTEM_DESIGN.md
    UI_GUIDELINES.md
    VALIDATION_RULEBOOK.md
    api-spec.md
    architecture.md
    database-design.md
    development-prompt.md
    git-workflow.md
    setup-local.md
    ui-ux-guidelines.md
  .github/
    workflows/
  README.md
```

## Local Setup Overview
The implementation is being structured around:

- PostgreSQL for local persistence
- `apps/api` for the Express backend
- `apps/web` for the React frontend

Expected environment variables include:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reimbursement_management
JWT_SECRET=replace-with-a-long-random-string
PORT=4000
CLIENT_URL=http://localhost:5173
COUNTRY_CACHE_TTL_HOURS=24
RATE_CACHE_TTL_MINUTES=60
UPLOAD_DIR=./uploads
```

Detailed setup steps are in [setup-local.md](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/setup-local.md).

## Current Build Direction

### Phase 1
- auth and onboarding
- user and manager mapping
- expense submission
- approval rules
- approval execution engine
- in-app notifications
- manager and admin reporting
- audit trail
- responsive UI
- local cache for country and currency data

### Phase 2
- OCR receipt parsing
- auto-filled expense draft fields
- extraction confidence score and review workflow

OCR is intentionally delayed until the reimbursement and approval flow is solid.

## Detailed Repository Documents

### Primary Detailed Docs
- [Architecture Notes](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/architecture.md)
- [Database Design](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/database-design.md)
- [API Specification](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/api-spec.md)
- [UI and UX Guidelines](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/ui-ux-guidelines.md)
- [Local Setup Guide](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/setup-local.md)
- [Git Workflow](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/git-workflow.md)
- [Development Prompt](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/development-prompt.md)

### Supporting Docs Already in the Repo
- [System Design](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/SYSTEM_DESIGN.md)
- [Database Schema](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/DATABASE_SCHEMA.md)
- [API Spec Summary](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/API_SPEC.md)
- [Validation Rulebook](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/VALIDATION_RULEBOOK.md)
- [Implementation Blueprint](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/IMPLEMENTATION_BLUEPRINT.md)
- [Roadmap](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/ROADMAP.md)
- [Presentation Checklist](D:/ASSIGNMENTS%20VIIT/SEM%206/Odoo_Reimbursement_management/docs/PRESENTATION_CHECKLIST.md)

## Team
- [VineetC137](https://github.com/VineetC137)
- [Asad](https://github.com/Asadp3406)
- [shraddhabhadane12](https://github.com/shraddhabhadane12) 

## Final Note
This project should feel like it was built by a team that understood the domain and made deliberate technical choices. The repo should tell that story clearly through the schema, the API design, the UI decisions, and the commit history on `main`.
