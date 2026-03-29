# Presentation Checklist

## Demo Flow
- Employee submits expense with receipt.
- OCR prefill shown and manually corrected.
- Manager reviews and approves/rejects with comment.
- Conditional rule path demonstrated (percentage/CFO/hybrid).
- Admin override action with audit reason.

## Explain Design Decisions
- Why normalized workflow schema?
- Why current index strategy?
- Why fallback FX behavior?
- How duplicate detection works?

## Evidence to Show
- Database migrations and seed data.
- Audit log timeline for one expense.
- Role-restricted API behavior.
- Git graph showing multi-contributor ownership.

## Risk/Constraint Disclosure
- OCR confidence caveats.
- FX provider dependency.
- Planned roadmap beyond MVP.
