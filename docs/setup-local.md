# Local Setup Guide

## Purpose
This document describes the current local development setup for the working implementation.

## 1. Required Tools
- Node.js 20+
- npm 10+ or pnpm
- PostgreSQL 15+
- Git

Optional but useful:

- Prisma Studio
- Postman or Insomnia
- pgAdmin or TablePlus

## 2. Suggested Project Layout
```text
/
|-- client/                  # React + Vite frontend
|-- server/                  # Express + TypeScript backend
|-- prisma/                  # Prisma schema and migrations
|-- docs/                    # Technical docs
|-- uploads/                 # Local attachment storage for development
|-- .env.example
|-- package.json
```

## 3. PostgreSQL Setup

### Create the Database
```sql
CREATE DATABASE reimbursement_management;
```

### Recommended Local Credentials
```text
Host: localhost
Port: 5432
Database: reimbursement_management
User: postgres
Password: postgres
```

These credentials are only for local development. They should not be reused in shared or deployed environments.

## 4. Environment Variables
Create a `.env` file based on the following structure:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reimbursement_management
PORT=4000
CLIENT_URL=http://localhost:5173
PUBLIC_API_BASE_URL=http://localhost:4000
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-another-long-random-string
COUNTRY_CACHE_MAX_AGE_HOURS=24
CURRENCY_RATE_CACHE_MAX_AGE_HOURS=12
UPLOAD_DIR=./storage/uploads
OCR_LANGUAGE=eng
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### Variable Notes
- `DATABASE_URL`: used by Prisma and the backend
- `JWT_ACCESS_SECRET`: used to sign access tokens
- `JWT_REFRESH_SECRET`: reserved for longer session handling
- `PORT`: backend port
- `CLIENT_URL`: frontend origin for CORS
- `PUBLIC_API_BASE_URL`: used when generating receipt URLs and API docs server metadata
- `COUNTRY_CACHE_MAX_AGE_HOURS`: refresh interval for country/currency mapping cache
- `CURRENCY_RATE_CACHE_MAX_AGE_HOURS`: refresh interval for exchange-rate cache
- `UPLOAD_DIR`: local development attachment storage
- `OCR_LANGUAGE`: Tesseract language code for local receipt OCR
- `VITE_API_BASE_URL`: frontend API base URL

## 5. Expected Installation Flow

### Root Install
```powershell
npm install
```

### Prisma Setup
```powershell
npm run prisma:generate
npm run prisma:migrate -w @reimbursement/api -- --name local_setup
```

### Seed Base Data
The current seed creates:

- system roles
- a demo company
- admin, manager, finance, and employee accounts
- default expense categories
- manager mappings
- a default workflow with hybrid approval rules
- sample draft, in-review, approved, and rejected expenses
- notification and audit-log examples

Suggested command:

```powershell
npm run prisma:seed
```

## 6. Running the App Locally

### Backend
```powershell
npm run dev:api
```

### Frontend
```powershell
npm run dev:web
```

### Validation
```powershell
npm run build
npm run test
```

Expected local URLs:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4000`

## 7. Migrations and Schema Discipline
Because database design is a major evaluation criterion, schema work should be handled carefully.

Rules:

- every schema change must be captured in a migration
- do not edit production-intended tables manually from a GUI without adding a migration
- name migrations clearly
- test the app on a fresh database after each schema change

Example migration naming:

- `init-auth-company-schema`
- `add-expense-approval-tables`
- `add-currency-cache-and-rates`

## 8. Seed Data Strategy
Seed data should be minimal and purposeful.

Recommended seed content:

- roles: `ADMIN`, `MANAGER`, `EMPLOYEE`
- one demo company with realistic users and manager hierarchy
- categories: travel, food, accommodation, fuel, office supplies, miscellaneous
- a ready-to-review workflow and sample expenses for presentation

Do not turn seed files into the final source of truth for runtime business data.

## 9. File Uploads in Local Development
For now, local file storage is enough.

Rules:

- keep uploads in a local `storage/uploads/` directory
- store metadata and OCR output in the database
- validate type and size on upload
- never trust client-side MIME type alone
- uploaded files can be processed by local OCR for image, PDF, and text receipts

## 10. Offline and Failure Scenarios
The project should still behave acceptably if the internet is unavailable during development or demo.

Planned behavior:

- country/currency data comes from the last valid cache if remote fetch fails
- exchange-rate lookup uses the last valid stored rate
- if no valid cache exists, show a clear admin-facing setup warning instead of crashing the app

## 11. Team Workflow in Local Development
- each member should pull latest `main` before starting
- commits should be small enough to explain
- database migrations should be coordinated to avoid conflicts
- if one member changes the schema, others should update and rerun migrations before continuing

## 12. Definition of Ready Before Coding Starts
Before scaffolding implementation, the team should confirm:

- final database schema reviewed
- API contract reviewed
- approval rules understood by all members
- UI direction approved
- commit ownership expectations agreed

If those are clear, the team can start building without losing time to avoidable rework.
