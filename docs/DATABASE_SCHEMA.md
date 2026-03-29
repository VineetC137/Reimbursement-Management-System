# Database Schema

## Design Goals
- Strict foreign keys.
- Normalized workflow and approval entities.
- Soft delete where restore/audit is needed.
- High-read indexes for queue and reporting.

## Core Tables
- `companies`
- `users`
- `roles`
- `user_roles`
- `manager_mappings`
- `expense_categories`
- `expenses`
- `expense_receipts`
- `approval_workflows`
- `workflow_steps`
- `workflow_step_approvers`
- `approval_rules`
- `approval_rule_conditions`
- `expense_approval_instances`
- `expense_approval_actions`
- `currency_rates`
- `notifications`
- `audit_logs`

## Indexing Strategy
- `users(company_id, email)` unique.
- `expenses(company_id, employee_id, status, submitted_at)`.
- `expense_approval_instances(current_step_order, status)`.
- `expense_approval_actions(instance_id, acted_at)`.
- `currency_rates(base_currency, quote_currency, fetched_at desc)`.
- `notifications(user_id, read_at, created_at desc)`.

## State Enums
- `expense_status`: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `ESCALATED`, `PAID`.
- `approval_action`: `APPROVE`, `REJECT`, `ESCALATE`, `OVERRIDE_APPROVE`, `OVERRIDE_REJECT`.
- `notification_status`: `PENDING`, `SENT`, `FAILED`, `READ`.

## Migration Approach
1. Initialize base auth/company/role tables.
2. Add expense and receipt entities.
3. Add workflow, rule, and runtime approval entities.
4. Add notification and audit tables.
5. Seed default roles/categories/workflow templates.

## Seed Data
- Roles: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Baseline categories: travel, meals, lodging, supplies.
- Optional default workflow template (manager-first).

## Notes
See executable ORM schema: `apps/api/prisma/schema.prisma`.
