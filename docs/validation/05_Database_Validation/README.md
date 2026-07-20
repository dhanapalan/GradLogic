# 05 — Database Validation

Validate inserts/updates/FKs/transactions/soft-delete/timestamps for Wave 1 flows.

**Wave 1 detail:** [WAVE1_DATA_INTEGRITY.md](./WAVE1_DATA_INTEGRITY.md)

Use read-only SQL against local Docker Postgres (`talentsecure-postgres` :5434) after Path A / onboarding runs. Prefer verifying via API then confirming tables — do not leave orphaned test junk (see verify skill cleanup).
