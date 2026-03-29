# Reimbursement Management System

A production-grade reimbursement platform that replaces manual expense processing with configurable approval workflows, conditional rule logic, currency conversion, OCR-assisted receipt extraction, and full audit visibility.

## Problem Statement
Organizations lose time and accuracy when reimbursements are handled over email and spreadsheets. This system provides:

- Dynamic multi-level approval flows.
- Conditional approval rules (percentage, specific approver, or hybrid).
- Country-aware company setup with base currency auto-selection.
- OCR-assisted receipt extraction with editable output.
- End-to-end timeline, audit logs, and role-based dashboards.

## Core Principles
- Database-first architecture and strict relational integrity.
- Clear module boundaries for long-term maintainability.
- Strong validation on both client and server.
- Explainable technical decisions and practical trade-offs.

## Recommended Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod + React Hook Form
- **Auth**: JWT access + rotating refresh tokens
- **OCR**: Tesseract service module

## Dynamic Integrations
- Country/Currency source: `https://restcountries.com/v3.1/all?fields=name,currencies`
- Exchange rates: `https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}`

Resilience strategy:
- Persist country/currency and FX data with TTL.
- Fallback to the last known valid FX rate during provider outages.
- Queue notifications with retry.

## Role Capabilities
- **Admin**: company/user management, workflow/rule configuration, override approvals with audit reason.
- **Manager**: approve/reject/escalate, team expense visibility, action comments.
- **Employee**: submit expenses, upload receipts, track claim timeline.

## UI Theme Tokens
- `--color-bg`: `#FFFFFF`
- `--color-primary`: `#38BDF8`
- `--color-primary-soft`: `#E0F2FE`
- `--color-danger`: `#EF4444`
- `--color-text`: `#0F172A`
- `--color-border`: `#E2E8F0`

## Repository Structure
```bash
reimbursement-management-system/
  apps/
    api/
      prisma/
      src/
    web/
      src/
  packages/
    ui/
    config/
    types/
  docs/
    SYSTEM_DESIGN.md
    DATABASE_SCHEMA.md
    API_SPEC.md
    VALIDATION_RULEBOOK.md
    UI_GUIDELINES.md
    GIT_WORKFLOW.md
    PRESENTATION_CHECKLIST.md
  .github/
    pull_request_template.md
    workflows/
  README.md
```

## Local Setup (Planned)
1. Configure PostgreSQL and create `.env` from `.env.example`.
2. Install dependencies in `apps/api` and `apps/web`.
3. Run Prisma migrate + seed.
4. Start API and web apps in parallel.

## Delivery Artifacts
- [System Design](docs/SYSTEM_DESIGN.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [API Specification](docs/API_SPEC.md)
- [Validation Rulebook](docs/VALIDATION_RULEBOOK.md)
- [UI Guidelines](docs/UI_GUIDELINES.md)
- [Git Workflow](docs/GIT_WORKFLOW.md)
- [Presentation Checklist](docs/PRESENTATION_CHECKLIST.md)
