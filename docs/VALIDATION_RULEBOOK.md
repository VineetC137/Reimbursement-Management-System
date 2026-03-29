# Validation Rulebook

## Identity & Access
- Email format required; unique within company.
- Password minimum 12 chars with complexity policy.
- Role changes must not leave dangling manager relationships.

## Expense Submission
- `amount > 0`, precision max 2 decimals.
- `currency` must be ISO-4217 and active in company setup.
- `expense_date` cannot exceed policy future threshold.
- Category required and must belong to company.
- Receipt upload required for amounts above policy threshold.

## Duplicate Prevention
- Fingerprint: `(employee_id, amount, category_id, expense_date, merchant?)`.
- Reject if duplicate found inside configured lookback window.

## Approval Actions
- Rejection requires non-empty comment.
- Action must belong to current pending approver.
- Override actions restricted to Admin with reason.

## File Upload Safety
- Allowed MIME types: jpeg/png/pdf.
- Max size policy (e.g., 5MB default).
- Optional antivirus scanning hook.

## API-Level Rules
- Validate all payloads with Zod.
- Reject unknown fields (strict schemas).
- Return deterministic error codes for UI mapping.
