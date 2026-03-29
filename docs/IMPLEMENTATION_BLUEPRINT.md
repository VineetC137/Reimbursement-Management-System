# Implementation Blueprint

## Folder Structure
```bash
apps/
  api/
    prisma/
      schema.prisma
      seed.ts
    src/
      app.ts
      server.ts
      config/
      middleware/
      modules/
  web/
    src/
      App.tsx
      main.tsx
      styles/tokens.css
packages/
  config/
  types/
  ui/
docs/
  SYSTEM_DESIGN.md
  DATABASE_SCHEMA.md
  API_SPEC.md
  VALIDATION_RULEBOOK.md
  UI_GUIDELINES.md
  GIT_WORKFLOW.md
  PRESENTATION_CHECKLIST.md
  ROADMAP.md
  IMPLEMENTATION_BLUEPRINT.md
```

## Endpoint List
See `docs/API_SPEC.md` for full route inventory grouped by module.

## UI Screen List
- Auth (company bootstrap + login)
- Admin dashboard
- User management + manager mapping
- Expense create/edit/detail
- Approval queue
- Workflow/rules configuration
- Reports and audit timeline
- Notification center

## SQL/ORM Schema
- Prisma models and enums are defined in `apps/api/prisma/schema.prisma`.
- Includes all required entities, status enums, indexes, and FK relationships.

## Test Checklist (MVP)
- Auth bootstrap creates company + admin.
- Admin can create manager and employee.
- Employee submits expense with receipt.
- OCR extraction returns editable fields.
- Sequential approvals move by step order.
- Rejection requires comment.
- Hybrid rules finalize status correctly.
- FX fallback uses last valid rate.
- Audit logs capture all transitions.
