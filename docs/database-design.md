# Database Design

## 1. Design Goals
This project should be designed from the database outward. The schema needs to do more than store forms. It needs to support:

- company isolation in a multi-tenant setup
- role-based access
- reporting manager relationships
- expenses in mixed currencies
- configurable approval rules
- sequential and conditional approvals
- immutable approval history
- local caching of external data
- auditability for every sensitive action

The schema below assumes PostgreSQL and Prisma.

## 2. High-Level Modeling Rules
- every business record belongs to a company unless it is global reference data
- approval decisions must be replayable from stored records
- in-flight approvals must not break when admin changes a rule later
- amounts must always preserve both original currency and company-normalized currency
- comments and overrides must be stored as data, not inferred from current status

## 3. Core Tables

### `companies`
Stores the company created during first signup.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `name` | `varchar(150)` | required |
| `country_code` | `varchar(3)` | ISO country code |
| `country_name` | `varchar(100)` | denormalized for convenience |
| `base_currency_code` | `varchar(3)` | required |
| `base_currency_name` | `varchar(50)` | required |
| `is_active` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

Indexes:

- unique index on `id`
- index on `country_code`
- index on `base_currency_code`

### `roles`
Reference table for application roles.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `code` | `varchar(30)` | unique, values like `ADMIN`, `MANAGER`, `EMPLOYEE` |
| `name` | `varchar(50)` | display label |
| `description` | `text` | optional |
| `created_at` | `timestamptz` | default now |

Indexes:

- unique index on `code`

### `users`
Stores all users under a company.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `role_id` | `uuid` | FK to `roles.id` |
| `first_name` | `varchar(60)` | required |
| `last_name` | `varchar(60)` | required |
| `email` | `varchar(180)` | required |
| `password_hash` | `text` | required |
| `job_title` | `varchar(100)` | optional |
| `department` | `varchar(100)` | optional |
| `is_active` | `boolean` | default `true` |
| `last_login_at` | `timestamptz` | optional |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

Constraints:

- unique `(company_id, email)`

Indexes:

- index on `company_id`
- index on `role_id`
- index on `(company_id, is_active)`

### `employee_manager_relations`
Tracks who reports to whom. This is kept separate from `users` so the project can support change history instead of only the latest manager.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `employee_user_id` | `uuid` | FK to `users.id` |
| `manager_user_id` | `uuid` | FK to `users.id` |
| `is_primary` | `boolean` | default `true` |
| `starts_at` | `date` | required |
| `ends_at` | `date` | nullable for active relation |
| `created_by_user_id` | `uuid` | FK to `users.id` |
| `created_at` | `timestamptz` | default now |

Constraints:

- employee and manager must belong to the same company
- employee and manager cannot be the same user

Indexes:

- index on `employee_user_id`
- index on `manager_user_id`
- partial index on active relation where `ends_at is null`

## 4. Expense Domain Tables

### `expense_categories`
Support table for categories shown in the UI and stored in expenses.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | nullable if using shared defaults |
| `code` | `varchar(40)` | internal key |
| `label` | `varchar(80)` | display value |
| `is_active` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default now |

Constraints:

- unique `(company_id, code)`

### `expenses`
Main table for employee claims.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `employee_user_id` | `uuid` | FK to `users.id` |
| `category_id` | `uuid` | FK to `expense_categories.id` |
| `title` | `varchar(150)` | short summary like `Client dinner at Pune` |
| `description` | `text` | optional longer note |
| `expense_date` | `date` | required |
| `original_amount` | `numeric(14,2)` | required |
| `original_currency_code` | `varchar(3)` | required |
| `exchange_rate_to_company` | `numeric(18,8)` | required |
| `company_amount` | `numeric(14,2)` | required |
| `company_currency_code` | `varchar(3)` | copied from company |
| `status` | `varchar(30)` | values like `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `submitted_at` | `timestamptz` | nullable |
| `final_decided_at` | `timestamptz` | nullable |
| `approval_rule_snapshot_id` | `uuid` | FK to `approval_rule_snapshots.id` |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

Constraints:

- `original_amount > 0`
- `company_amount > 0`

Indexes:

- index on `(company_id, employee_user_id, status)`
- index on `(company_id, status, submitted_at desc)`
- index on `approval_rule_snapshot_id`

### `expense_receipts`
Stores receipt-specific metadata and future OCR data.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `expense_id` | `uuid` | FK to `expenses.id` |
| `file_name` | `varchar(255)` | stored original name |
| `storage_path` | `text` | local filesystem path |
| `mime_type` | `varchar(100)` | validated server-side |
| `file_size_bytes` | `integer` | required |
| `ocr_status` | `varchar(30)` | `NOT_REQUESTED`, `PENDING`, `COMPLETED`, `FAILED` |
| `ocr_raw_text` | `text` | nullable |
| `ocr_extracted_payload` | `jsonb` | nullable |
| `ocr_confidence` | `numeric(5,2)` | nullable |
| `processed_at` | `timestamptz` | nullable |
| `uploaded_at` | `timestamptz` | default now |

Indexes:

- index on `expense_id`
- index on `ocr_status`

### `expense_attachments`
Stores non-receipt supporting files if the team wants separate documentation uploads.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `expense_id` | `uuid` | FK to `expenses.id` |
| `file_name` | `varchar(255)` | required |
| `storage_path` | `text` | required |
| `mime_type` | `varchar(100)` | required |
| `file_size_bytes` | `integer` | required |
| `uploaded_by_user_id` | `uuid` | FK to `users.id` |
| `uploaded_at` | `timestamptz` | default now |

Indexes:

- index on `expense_id`

## 5. Approval Configuration Tables

### `approval_rules`
Top-level policy record created by admin.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `name` | `varchar(150)` | required |
| `description` | `text` | optional |
| `category_id` | `uuid` | nullable FK to `expense_categories.id` |
| `min_amount_company` | `numeric(14,2)` | nullable |
| `max_amount_company` | `numeric(14,2)` | nullable |
| `is_manager_approver` | `boolean` | default `false` |
| `sequence_required` | `boolean` | default `true` |
| `minimum_approval_percentage` | `numeric(5,2)` | nullable |
| `specific_approver_user_id` | `uuid` | nullable FK to `users.id` |
| `decision_mode` | `varchar(30)` | `SEQUENTIAL`, `PERCENTAGE`, `SPECIFIC_APPROVER`, `HYBRID` |
| `priority` | `integer` | lower value means higher priority |
| `is_active` | `boolean` | default `true` |
| `created_by_user_id` | `uuid` | FK to `users.id` |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

Indexes:

- index on `(company_id, is_active, priority)`
- index on `(company_id, category_id)`
- index on `specific_approver_user_id`

### `approval_rule_steps`
Stores ordered approvers or approver placeholders.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `approval_rule_id` | `uuid` | FK to `approval_rules.id` |
| `step_order` | `integer` | required |
| `step_type` | `varchar(30)` | `USER`, `ROLE`, `MANAGER` |
| `approver_user_id` | `uuid` | nullable FK to `users.id` |
| `approver_role_code` | `varchar(30)` | nullable for future role-based routing |
| `is_required` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default now |

Constraints:

- unique `(approval_rule_id, step_order)`

Indexes:

- index on `approval_rule_id`
- index on `approver_user_id`

### `approval_conditions`
Captures conditional logic separately from the ordered steps.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `approval_rule_id` | `uuid` | FK to `approval_rules.id` |
| `condition_type` | `varchar(40)` | `MIN_PERCENTAGE`, `SPECIFIC_APPROVER`, `HYBRID_OR`, `HYBRID_AND` |
| `threshold_percentage` | `numeric(5,2)` | nullable |
| `specific_approver_user_id` | `uuid` | nullable FK to `users.id` |
| `created_at` | `timestamptz` | default now |

Indexes:

- index on `approval_rule_id`
- index on `specific_approver_user_id`

## 6. Snapshot Tables for In-Flight Integrity

### `approval_rule_snapshots`
Stores an immutable copy of the rule applied to a specific expense. This is critical because the admin may later edit the original rule.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `source_approval_rule_id` | `uuid` | FK to `approval_rules.id` |
| `expense_id` | `uuid` | unique FK to `expenses.id` |
| `name` | `varchar(150)` | copied from source rule |
| `is_manager_approver` | `boolean` | copied |
| `sequence_required` | `boolean` | copied |
| `minimum_approval_percentage` | `numeric(5,2)` | copied |
| `specific_approver_user_id` | `uuid` | nullable |
| `decision_mode` | `varchar(30)` | copied |
| `snapshot_payload` | `jsonb` | full immutable rule copy |
| `created_at` | `timestamptz` | default now |

Indexes:

- unique index on `expense_id`
- index on `source_approval_rule_id`

### `approval_rule_snapshot_steps`
Stores immutable ordered steps copied from the live rule at submission time.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `approval_rule_snapshot_id` | `uuid` | FK to `approval_rule_snapshots.id` |
| `step_order` | `integer` | required |
| `step_type` | `varchar(30)` | copied |
| `approver_user_id` | `uuid` | nullable |
| `approver_role_code` | `varchar(30)` | nullable |
| `is_required` | `boolean` | copied |
| `created_at` | `timestamptz` | default now |

Constraints:

- unique `(approval_rule_snapshot_id, step_order)`

## 7. Approval Execution Tables

### `expense_approval_instances`
Represents approver-level work items created for a submitted expense.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `expense_id` | `uuid` | FK to `expenses.id` |
| `company_id` | `uuid` | FK to `companies.id` |
| `approval_rule_snapshot_id` | `uuid` | FK to `approval_rule_snapshots.id` |
| `step_order` | `integer` | nullable for pure percentage pools |
| `stage_group` | `integer` | approvers in the same active group share this |
| `approver_user_id` | `uuid` | FK to `users.id` |
| `source_type` | `varchar(30)` | `MANAGER`, `RULE_STEP`, `SPECIFIC_APPROVER`, `AUTO_GENERATED` |
| `status` | `varchar(30)` | `WAITING`, `PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`, `AUTO_APPROVED` |
| `is_active` | `boolean` | indicates current actionable item |
| `required_for_progress` | `boolean` | whether this approver is mandatory |
| `activated_at` | `timestamptz` | nullable |
| `responded_at` | `timestamptz` | nullable |
| `comment_snapshot` | `text` | latest action summary for quick display |
| `created_at` | `timestamptz` | default now |

Indexes:

- index on `(approver_user_id, status, is_active)`
- index on `(expense_id, step_order)`
- index on `(company_id, status)`

### `expense_approval_actions`
Immutable log of all approval actions.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `expense_id` | `uuid` | FK to `expenses.id` |
| `expense_approval_instance_id` | `uuid` | nullable FK to `expense_approval_instances.id` |
| `action_by_user_id` | `uuid` | FK to `users.id` |
| `action_type` | `varchar(30)` | `APPROVE`, `REJECT`, `COMMENT`, `OVERRIDE_APPROVE`, `OVERRIDE_REJECT`, `RESUBMIT` |
| `comment` | `text` | optional but required for reject and override by business rule |
| `action_metadata` | `jsonb` | optional |
| `acted_at` | `timestamptz` | default now |

Indexes:

- index on `expense_id`
- index on `action_by_user_id`
- index on `(expense_id, acted_at desc)`

## 8. External Data Cache Tables

### `currency_rates`
Stores normalized exchange-rate snapshots.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `base_currency_code` | `varchar(3)` | required |
| `target_currency_code` | `varchar(3)` | required |
| `rate` | `numeric(18,8)` | required |
| `source_name` | `varchar(80)` | example `exchange-rate-api` |
| `fetched_at` | `timestamptz` | required |
| `expires_at` | `timestamptz` | required |
| `created_at` | `timestamptz` | default now |

Constraints:

- unique `(base_currency_code, target_currency_code, fetched_at)`

Indexes:

- index on `(base_currency_code, target_currency_code, expires_at desc)`

### `country_currency_cache`
Stores country to currency mapping so onboarding does not rely on live API availability.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `country_code` | `varchar(3)` | unique |
| `country_name` | `varchar(100)` | required |
| `currency_code` | `varchar(3)` | required |
| `currency_name` | `varchar(80)` | optional |
| `currency_symbol` | `varchar(10)` | optional |
| `source_name` | `varchar(80)` | required |
| `last_synced_at` | `timestamptz` | required |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

Indexes:

- unique index on `country_code`
- index on `currency_code`

## 9. Audit and Notification Tables

### `audit_logs`
Tracks sensitive changes for traceability and demo transparency.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `actor_user_id` | `uuid` | FK to `users.id` |
| `entity_type` | `varchar(50)` | example `EXPENSE`, `APPROVAL_RULE`, `USER` |
| `entity_id` | `uuid` | referenced record id |
| `action` | `varchar(80)` | example `CREATE_EXPENSE`, `OVERRIDE_REJECTION` |
| `old_values` | `jsonb` | nullable |
| `new_values` | `jsonb` | nullable |
| `ip_address` | `varchar(64)` | optional |
| `created_at` | `timestamptz` | default now |

Indexes:

- index on `(company_id, entity_type, entity_id)`
- index on `(actor_user_id, created_at desc)`

### `notifications`
Keeps in-app notifications persistent.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `company_id` | `uuid` | FK to `companies.id` |
| `user_id` | `uuid` | FK to `users.id` |
| `type` | `varchar(50)` | example `APPROVAL_REQUEST`, `EXPENSE_APPROVED`, `EXPENSE_REJECTED` |
| `title` | `varchar(150)` | required |
| `message` | `text` | required |
| `related_entity_type` | `varchar(50)` | optional |
| `related_entity_id` | `uuid` | optional |
| `is_read` | `boolean` | default `false` |
| `created_at` | `timestamptz` | default now |
| `read_at` | `timestamptz` | nullable |

Indexes:

- index on `(user_id, is_read, created_at desc)`

## 10. Relationship Map
- one `company` has many `users`
- one `role` has many `users`
- one `employee` can have one active primary manager relation at a time
- one `expense` belongs to one employee and one company
- one `expense` may have many `expense_receipts` and `expense_attachments`
- one `approval_rule` has many `approval_rule_steps` and `approval_conditions`
- one submitted `expense` gets one `approval_rule_snapshot`
- one `approval_rule_snapshot` has many `approval_rule_snapshot_steps`
- one `expense` has many `expense_approval_instances`
- one `expense` has many `expense_approval_actions`

## 11. Integrity Rules Worth Enforcing
- do not allow submission without at least one valid approval route
- do not allow manager-first rule if employee has no active manager mapping
- do not allow `minimum_approval_percentage` outside `0 < x <= 100`
- do not allow `specific_approver_user_id` outside the same company
- do not allow approval action once instance status is already terminal
- do not allow override action by non-admin user

## 12. Query Hotspots and Indexing Strategy
The UI will repeatedly ask for the following:

- employee expense history
- manager pending approvals
- admin company-wide expense list
- expense approval timeline
- active rule lookup by company, category, and amount band

That is why the schema uses indexes on:

- company and status combinations
- approver queue fields
- created and submitted timestamps
- rule priority and activity state

## 13. Suggested Prisma Enums
These can be modeled as Prisma enums or constrained strings.

- `RoleCode`: `ADMIN`, `MANAGER`, `EMPLOYEE`
- `ExpenseStatus`: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`
- `DecisionMode`: `SEQUENTIAL`, `PERCENTAGE`, `SPECIFIC_APPROVER`, `HYBRID`
- `ApprovalInstanceStatus`: `WAITING`, `PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`, `AUTO_APPROVED`
- `ApprovalActionType`: `APPROVE`, `REJECT`, `COMMENT`, `OVERRIDE_APPROVE`, `OVERRIDE_REJECT`, `RESUBMIT`
- `OcrStatus`: `NOT_REQUESTED`, `PENDING`, `COMPLETED`, `FAILED`

## 14. Final Recommendation
Do not simplify the schema too early. The project will be judged heavily on whether the team understood how approval logic, currency normalization, and auditability should work in a real system. A solid relational design will make the rest of the implementation easier to justify.
