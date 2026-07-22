# College Module Feedback Backlog

**Source:** College Module Feedbacks.docx (stakeholder review, received 2026-07-22)
**Status legend:** 🔴 Not started · 🟡 In progress · 🟢 Done

---

## Bugs (correctness issues, not roadmap)

| # | Item | Module | Priority | Status |
|---|------|--------|----------|--------|
| B1 | Bulk question import is not idempotent — retrying the same file after a partial failure re-imports the successful rows as duplicates | Question Bank | High | 🟢 |
| B2 | No per-row import status after bulk upload — can't tell which of N questions failed vs. succeeded | Question Bank | High | 🟢 |
| B3 | Students Module bulk upload redirects to a blank/unconfigured page | Students | High | 🟢 |

## Enhancements

| # | Item | Module | Priority | Status |
|---|------|--------|----------|--------|
| E1 | Bulk import template: replace free-text fields (category, difficulty) with dropdowns to eliminate typo-driven import failures | Question Bank | Medium | 🔴 |
| E2 | Add multi-select for bulk activate / deactivate / soft-delete of questions (currently row-by-row only) | Question Bank | Medium | 🔴 |
| E3 | Make "department" a configurable per-college value instead of plain text | Students | Medium | 🔴 |
| E4 | Replace scroll-and-pick question selection with filter/tag-based selection, ideally a grid/modal multi-select UI | Create Assessment | Medium | 🔴 |

## Missing Features (structural gaps)

| # | Item | Module | Priority | Status |
|---|------|--------|----------|--------|
| F1 | Faculty accounts: self-registration/import + department-scoped dashboards (own question banks, assessments, student outcomes only). Called out as a hard isolation requirement | College / Auth | High | 🔴 |
| F2 | Notification system: scheduled (EOD-style) notifications to students and faculty on assessment completion/pending status, instead of requiring manual login to check | Cross-cutting | High | 🔴 |
| F3 | Evaluation/reporting view: submitted assessment data with AI-generated summaries, per-student and per-department (outcomes, improvement areas) | Evaluation | Medium | 🔴 |
| F4 | AI question-bank generator — admins prompt for needs, questions generated and imported directly | Question Bank / AI | Medium | 🔴 |
| F5 | Surface AI capability into Super Admin's eligible-college config (currently only manual bulk import + manual assessment creation, no AI path) | Super Admin / AI | Medium | 🔴 |
| F6 | Payment tracking module | College | Low | 🔴 |
| F7 | Campus Drive module — acceptable as a future add-on; can exist as a "scenario" placeholder for now | College | Low | 🔴 |

---

## Completed (2026-07-22)

- **B1** — `server/src/services/collegeQuestionBank.service.ts`: bulk import silently passed `force: true` on every row, bypassing the existing title-based duplicate check (`findDuplicateTitle`). Removed the override so retries land in `skipped[]` instead of creating duplicates. Verified via direct API round-trip: same file imported twice → 2/2 successful the first time, 2/2 skipped as duplicates the second time, 1 row in DB per question.
- **B2** — `client/src/pages/college-portal/QuestionBankPage.tsx`: backend already returned `failed[]`/`skipped[]` with row + reason; the import dialog only rendered aggregate counts. Added a detail table listing row, status, and reason for every failed/skipped row.
- **B3** — Root cause wasn't a missing route: `client/src/components/CollegeLegacyFeatureGuard.tsx` was missing a redirect rule for `/app/students/bulk-import`, so college-role users landed on a legacy page that hand-rolls CSV parsing and posts students one-by-one. Added the redirect to the working College Portal students page. While verifying, found and fixed an unrelated pre-existing bug in `client/src/components/college-portal/StudentBulkUploadModal.tsx` — a Rules-of-Hooks violation (early `return null` between hook calls) that crashed the app whenever the "real" bulk-upload modal was opened. Both issues needed fixing for the flow to actually work; verified live in-browser.

## Suggested sequencing

1. **B1–B3** — fix first; these are data-integrity and dead-page bugs, not new work.
2. **F1, F2** — flagged most strongly as structural gaps (isolation, notifications); scope these next.
3. **E1–E4** — UX hardening around bulk import and assessment creation.
4. **F3–F5** — AI-driven evaluation/reporting and generation; larger scope, sequence after core gaps close.
5. **F6, F7** — explicitly deferred by the stakeholder; track but don't schedule yet.
