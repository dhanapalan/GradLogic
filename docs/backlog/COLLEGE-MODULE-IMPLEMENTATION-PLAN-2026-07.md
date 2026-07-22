# College Module Feedback — Implementation Plan

Companion to [COLLEGE-MODULE-FEEDBACK-BACKLOG-2026-07.md](./COLLEGE-MODULE-FEEDBACK-BACKLOG-2026-07.md). Grounded in a codebase pass on 2026-07-22 — file paths below are current as of that pass.

**Two scoping corrections from the raw backlog, found during this pass:**

- **B3 is not a missing/broken route.** There are *two* competing student bulk-upload implementations. The one the feedback hit (`client/src/pages/students/BulkImportStudentsPage.tsx`) is legacy, hand-rolls CSV parsing, and never calls the real bulk endpoint — it POSTs students one-by-one. A second, correct implementation already exists and is used elsewhere (`StudentBulkUploadModal.tsx` → `POST /campus/students/bulk-import`). The fix is deletion + redirect, not new development.
- **F7 (Campus Drive) is already a substantial, working feature** — 9 Prisma models, a full service layer, capacity/scheduling rule enforcement, and an auto-transition scheduler. It is not a gap. Recommend re-confirming with the stakeholder what "future add-on" actually refers to before scheduling any work here — likely a UI/discoverability gap in the College portal, not a backend build.

---

## Phase 1 — Bugs (B1–B3)

### B1 + B2: Bulk import idempotency + per-row status
**Files:** `server/src/services/collegeQuestionBank.service.ts:787-916` (`importQuestionsFromExcel`), `server/src/controllers/campus.questions.controller.ts:178`

The service already buckets rows into `successful[] / failed[] / skipped[]` and returns row-level detail — B2's "no visibility" complaint is a **frontend** gap, not backend. Confirm the college-portal import UI actually renders `failed`/`skipped` from the response; if it just shows a toast, that's the fix (render a results table: row #, status, reason).

B1 (duplicate re-import) is real: dedup is keyed on `question_code` via the DB unique constraint `college_questions_code_unique(college_id, question_code)`, and skip-detection is done by string-matching "duplicate" in the thrown error (`collegeQuestionBank.service.ts:787-916`) — fragile, but functionally means *a duplicate code is already rejected as skipped*. The reported bug is more likely: rows have **blank/auto-generated codes**, so retried rows get new codes and don't collide. Two options:
- **Minimal fix:** if the template doesn't require a code, derive one deterministically from row content (e.g. hash of question text + college_id) instead of leaving it blank/random, so retries naturally collide and land in `skipped`.
- **Better fix:** use the existing `question_bank.embedding vector(1536)` pattern (schema comment already flags it "for duplicate detection") — reuse `ai.service.ts`'s embed call to do near-duplicate detection on `college_questions` too, catching reworded duplicates the code-based check misses. Bigger lift; do the minimal fix first, embedding-based dedup as a fast-follow.

### B3: Students bulk upload
**Files:** `client/src/pages/students/BulkImportStudentsPage.tsx`, `client/src/App.tsx:1350-1359`, `client/src/components/CollegeLegacyFeatureGuard.tsx`, `client/src/components/college-portal/StudentBulkUploadModal.tsx`

1. Delete `BulkImportStudentsPage.tsx` and its route registration in `App.tsx:1350-1359`.
2. Redirect `students/bulk-import` to wherever `StudentBulkUploadModal` is triggered from in the college portal shell (or just remove the standalone route and rely on the in-shell modal entry point).
3. Separately verify the "blank page" wasn't *also* a `FeatureGuard` misconfiguration — check whether college accounts hitting this actually have the `"students"` feature flag enabled (`client/src/constants/platformFeatures.ts:155`, `usePortalFeatures`). If some colleges are missing that flag, that's a data-config fix, not code.

---

## Phase 2 — Structural gaps (F1, F2)

### F1: Faculty accounts + department-scoped isolation
**Files:** `prisma/schema.prisma:386-397` (`user_role` enum), `server/src/middleware/collegeIsolation.ts`

This is the largest item in the backlog. No `faculty` role exists today — `college_staff` is the closest analog but isn't department-scoped.

1. **Schema:** add `faculty` to `user_role` enum; add a `departments` table (college-scoped: `id, college_id, name`) — currently department is free text on `User`/`student_details`/`student_payments`, so this also unblocks E3. Add `department_id` FK to `User` (faculty + students), migrate existing free-text values.
2. **Isolation middleware:** extend `collegeIsolation.ts` — add `faculty` to `COLLEGE_SCOPED_ROLES`, then layer a *second* scoping dimension (department) on top of the existing college scoping for faculty-role requests to question-bank, assessment, and student-outcome endpoints. `effectiveCollegeId()` is the existing pattern to mirror for an `effectiveDepartmentId()`.
3. **Faculty self-registration/import:** decide invite-based (college admin invites, faculty sets password) vs. bulk-import (reuse the corrected bulk-import pattern from B3) — the feedback mentions both "self-registration" and "registering module," lean toward admin-driven bulk import for v1, matching how students are onboarded, with self-service invite as a fast-follow.
4. **Faculty dashboard (frontend):** new portal shell scoped to department — reuse existing college-portal patterns, filter queries by `department_id` server-side (never trust a client-supplied department filter, same pattern as `effectiveCollegeId()` for colleges).
5. **Sequencing dependency:** do the `departments` table + FK migration before E3, since E3 depends on it.

### F2: Notification system (scheduled digest)
**Files:** `server/src/modules/notifications/index.ts`, `server/src/services/notification.service.ts`, `server/src/services/email.service.ts`, `server/src/scheduler/driveScheduler.ts`, `server/src/queues/examTimer.queue.ts` / `workers/examTimer.worker.ts`

Good news: the plumbing exists (BullMQ + ioredis, nodemailer, an event bus with `DrivePublished`/`SessionInvalidated` subscribers). This is "add a new event type + a scheduled job," not new infrastructure.

1. **New event types:** `AssessmentCompleted`, `AssessmentPending` (or similar) published wherever assessment attempts finalize/expire.
2. **Digest job:** new BullMQ scheduled/repeatable job (mirror `examTimer.queue.ts`/`worker.ts` structure) that runs once daily (EOD), queries pending/completed assessment counts per student and per faculty/department, and calls `email.service.ts` to send a summary. This is a new queue+worker pair, not a generic cron dependency — `driveScheduler.ts`'s polling pattern is the alternative if BullMQ's repeatable jobs don't fit, but BullMQ is already a dependency so prefer it.
3. **No `notifications` DB table exists today** (current sends look log-only via `sendNotification`) — if in-app notification history/read-state is wanted (not just email), add one now; otherwise this can stay email-only for v1.
4. **Depends on F1** for department-level faculty digests (needs faculty/department model to know who to notify).

---

## Phase 3 — UX hardening (E1, E2, E4) + E3

### E1: Dropdown-driven import template
**Files:** `server/src/services/collegeQuestionBank.service.ts` (validation), whatever generates the downloadable template (check for an XLSX template generator near the import endpoint)

Change free-text `category`/`difficulty_level` cells to Excel data-validation dropdowns in the generated template (the `xlsx` package supports data validation on write), and tighten server-side validation to reject/normalize near-miss values (e.g. case-insensitive match) instead of hard-failing on typos. Low complexity, no schema change — `question_bank`/`college_questions` already use enums for these fields.

### E2: Multi-select bulk actions
**Files:** `client/src/pages/assessments/QuestionBankPage.tsx`, question-bank list/table component

Frontend-only: add row checkboxes + a selection toolbar (activate/deactivate/soft-delete), calling existing single-item endpoints in a batch (`Promise.all` or a new `PATCH /campus/questions/bulk-status` if N+1 requests become a concern at scale). Check `campus.questions.controller.ts` for whether a bulk-status endpoint already exists before building a new one.

### E3: Configurable department (depends on F1's `departments` table)
Once the `departments` table + FK exists, this is a UI change: replace the free-text department input on student/faculty forms with a `<select>` sourced from `GET /campus/departments`, plus a college-admin screen to manage the department list (add/rename/deactivate). New small CRUD controller + service, following the same shape as other college-scoped CRUD in `campus.*.controller.ts`.

### E4: Filter/grid question picker for assessment authoring
**Files:** `client/src/pages/assessments/AssessmentStudioPage.tsx`, `client/src/pages/assessments/QuestionBankPage.tsx`

`question_bank.tags` (GIN-indexed) and `category`/`difficulty_level` are already queryable — this is purely a frontend build: a modal/grid picker component with filter chips (tag, category, difficulty) and multi-select, replacing the current scroll-and-click flow inside the "Question Bank" tab of `AssessmentStudioPage`. Confirm `college_questions` has a `tags` column with parity to global `question_bank` before assuming filter parity — flagged as unconfirmed in the research pass.

---

## Phase 4 — AI-driven features (F3, F4, F5)

### F3: Evaluation/reporting with AI summaries
**Files:** `server/src/services/assessmentEvaluation.service.ts:494` (existing per-attempt AI coaching summary via dynamic `import("./ai.service.js")`), `server/src/services/collegeCampaignEvaluation.service.ts` (`getFacultyEvaluation`, `getStudentResult`), `server/src/utils/simpleReportPdf.ts`

The per-student AI summary pattern already exists for individual attempts. Extend it two directions:
1. **Department/college rollup summary:** new service function that aggregates `collegeCampaignEvaluation.service.ts` results across a department/college and feeds an aggregate prompt to `ai.service.ts`'s `generate()` (same call pattern as line 494) — "summarize outcomes and improvement areas across N students."
2. **Reporting UI:** new page combining `getFacultyEvaluation`/`getStudentResult` data with the new rollup summary; reuse `simpleReportPdf.ts` for exportable reports.
3. **Depends on F1** for the department-scoping dimension in rollups; can ship a college-level rollup first without waiting on F1 if that unblocks faster.

### F4: AI question-bank generator (prompt → questions)
**Files:** `ai-engine/question_bank_engine/` (Python, `QuestionBankEngine.generate_questions()`, RAG-based), `server/src/services/ai.service.ts:174` (`QUESTION_ENGINE_URL`, port 8001)

Most of this already exists in `ai-engine/question_bank_engine/` — it's a RAG-based question generator, just not exposed through the college portal. This is primarily a **wiring + UI task**, not new AI capability:
1. Add a server-side endpoint (`campus.questions.controller.ts`) that proxies a prompt to the existing `question_bank_engine` service (mirror the existing `QUESTION_ENGINE_URL` fetch pattern in `ai.service.ts`).
2. Frontend: a "Generate with AI" entry point in the Question Bank tab — prompt input, review/edit generated questions, then bulk-insert via the (now-fixed) B1/B2 import path so generated questions go through the same dedup/validation as file imports.

### F5: Surface AI capability in Super Admin's college config
**Files:** wherever Super Admin's "eligible colleges" / feature-flag config lives (check `platformFeatures.ts` and the corresponding Super Admin settings screen)

Once F4 exists, add an AI-question-generation feature flag to the per-college feature config Super Admin already manages (same mechanism as other `FeatureGuard` keys in `platformFeatures.ts:155`) so it can be toggled per college like other portal features. Small, mechanical — depends entirely on F4 landing first.

---

## Phase 5 — Deferred (F6, F7)

### F6: Payment tracking
**Files:** `prisma/schema.prisma:758-777` (`student_payments`), `server/src/services/mockPaymentGateway.service.ts`

Schema already fits ("purpose-built," per the research pass) — `status`, `paid_at`, `payment_method`, `payment_ref`, `recorded_by`, unique per `(student_id, academic_year)`. If scope is **manual fee recording** (college staff marks a student paid/unpaid), this is just a CRUD controller + UI over the existing table — small. If scope is **online payment collection**, the mock gateway needs replacing with a real provider (Razorpay is the common choice for INR billing) — that's the real cost, and it's explicitly flagged `TODO(payments)` in the code already. Recommend confirming which scope the stakeholder means before estimating.

### F7: Campus Drive
As noted at the top: this already exists as a full feature. Recommend going back to the stakeholder with "what specifically feels missing?" before writing a spec — possible gaps are College-portal-side discoverability/UI polish rather than backend capability, but that's a guess until clarified.

---

## Suggested delivery order

1. B1, B2, B3 (bugs — ship fast, mostly frontend + small backend hardening)
2. F1 (`departments` table + faculty role + isolation) — unblocks E3, F2's department digests, F3's department rollups
3. F2 (notification digest) — reuses existing BullMQ/event-bus infra
4. E1, E2, E4 (question bank + assessment UX) — parallelizable with F1/F2, no shared dependencies
5. E3 (depends on F1)
6. F4 → F5 (AI question generation, then Super Admin toggle)
7. F3 (evaluation rollups — can start college-level before F1 lands, department-level after)
8. F6, F7 — hold for stakeholder scope clarification before estimating
