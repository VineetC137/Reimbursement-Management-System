# System Design

## 1. Architecture Overview
The system follows a modular monorepo architecture:

- `apps/web`: React client for Admin, Manager, Employee experiences.
- `apps/api`: Express API with service/repository layering.
- `packages/types`: shared DTO and enum contracts.
- `packages/config`: reusable runtime/config schemas.

## 2. High-Level Components
1. **Auth & Identity**
   - Signup bootstraps company + admin.
   - JWT access + refresh token rotation.
2. **User Management**
   - User lifecycle, role assignment, manager mapping.
3. **Expense Domain**
   - Expense submission, receipt metadata, duplicate checks.
4. **Workflow Engine**
   - Workflow steps + approver sequence.
5. **Rule Engine**
   - Percentage/specific/hybrid conditions.
6. **Approval Runtime**
   - Per-expense approval instance/action tracking.
7. **Audit & Notification**
   - Immutable action logs and notification queue.
8. **Reporting**
   - Role-aware metrics and operational trends.

## 3. Request Lifecycle
1. Employee submits expense.
2. API validates payload and duplicate hash window.
3. FX service resolves conversion using cached/live rate.
4. Workflow engine materializes approval instance.
5. Current approver receives notification.
6. Approver action updates status and timeline.
7. Rule engine evaluates approval completion criteria.
8. Final status + audit records persisted.

## 4. External Integrations
- **Country/Currency API**: periodic sync + manual refresh.
- **FX API**: on-demand + scheduled rate cache refresh.
- **OCR Service**: async extraction from receipt image; user confirms editable fields before final submit.

## 5. Resilience and Offline Tolerance
- Local draft save in browser storage.
- API falls back to last valid FX rate with warning metadata.
- Notification retries with exponential backoff.
- Country/currency catalog cached in DB with TTL.

## 6. Security Boundaries
- Role + permission middleware for every protected endpoint.
- Password hashing with Argon2/Bcrypt.
- File upload MIME and size checks.
- Input schema validation and centralized error responses.
- Rate limiting on auth and expense submission endpoints.

## 7. Deployment Topology (Target)
- Web app served via CDN/static host.
- API behind reverse proxy.
- PostgreSQL as primary data store.
- Optional Redis for queue and cache acceleration.

## 8. Known Constraints
- OCR quality depends on receipt image quality and language.
- FX provider outages may temporarily use stale rates.
- Complex rule combinations require careful observability.

## 9. Future Improvements
- SSO (SAML/OIDC).
- Policy-as-code rule authoring UI.
- Fraud heuristics for anomaly detection.
