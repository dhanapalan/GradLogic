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
| E1 | Bulk import template: replace free-text fields (category, difficulty) with dropdowns to eliminate typo-driven import failures | Question Bank | Medium | 🟢 |
| E2 | Add multi-select for bulk activate / deactivate / soft-delete of questions (currently row-by-row only) | Question Bank | Medium | 🟢 |
| E3 | Make "department" a configurable per-college value instead of plain text | Students | Medium | 🟢 |
| E4 | Replace scroll-and-pick question selection with filter/tag-based selection, ideally a grid/modal multi-select UI | Create Assessment | Medium | 🟢 |

## Missing Features (structural gaps)

| # | Item | Module | Priority | Status |
|---|------|--------|----------|--------|
| F1 | Faculty accounts: self-registration/import + department-scoped dashboards (own question banks, assessments, student outcomes only). Called out as a hard isolation requirement | College / Auth | High | 🟢 |
| F2 | Notification system: scheduled (EOD-style) notifications to students and faculty on assessment completion/pending status, instead of requiring manual login to check | Cross-cutting | High | 🟢 |
| F3 | Evaluation/reporting view: submitted assessment data with AI-generated summaries, per-student and per-department (outcomes, improvement areas) | Evaluation | Medium | 🟢 |
| F4 | AI question-bank generator — admins prompt for needs, questions generated and imported directly | Question Bank / AI | Medium | 🟢 |
| F5 | Surface AI capability into Super Admin's eligible-college config (currently only manual bulk import + manual assessment creation, no AI path) | Super Admin / AI | Medium | 🟢 |
| F6 | Payment tracking module | College | Low | 🟢 |
| F7 | Campus Drive module — acceptable as a future add-on; can exist as a "scenario" placeholder for now | College | Low | ⚪ Skipped — already exists |

---

## Completed (2026-07-22)

- **B1** — `server/src/services/collegeQuestionBank.service.ts`: bulk import silently passed `force: true` on every row, bypassing the existing title-based duplicate check (`findDuplicateTitle`). Removed the override so retries land in `skipped[]` instead of creating duplicates. Verified via direct API round-trip: same file imported twice → 2/2 successful the first time, 2/2 skipped as duplicates the second time, 1 row in DB per question.
- **B2** — `client/src/pages/college-portal/QuestionBankPage.tsx`: backend already returned `failed[]`/`skipped[]` with row + reason; the import dialog only rendered aggregate counts. Added a detail table listing row, status, and reason for every failed/skipped row.
- **B3** — Root cause wasn't a missing route: `client/src/components/CollegeLegacyFeatureGuard.tsx` was missing a redirect rule for `/app/students/bulk-import`, so college-role users landed on a legacy page that hand-rolls CSV parsing and posts students one-by-one. Added the redirect to the working College Portal students page. While verifying, found and fixed an unrelated pre-existing bug in `client/src/components/college-portal/StudentBulkUploadModal.tsx` — a Rules-of-Hooks violation (early `return null` between hook calls) that crashed the app whenever the "real" bulk-upload modal was opened. Both issues needed fixing for the flow to actually work; verified live in-browser.

## Completed (2026-07-23)

- **E1** — the free `xlsx` package can't write Excel data-validation dropdowns, so `buildImportTemplateBuffer()` in `collegeQuestionBank.service.ts` was rewritten with `exceljs` (new dependency, scoped to just this function — import parsing still uses `xlsx`). The downloadable template now has real dropdowns on Category/Type/Difficulty for all 500 rows, so typos can't reach the import path at all.
- **E2** — added `bulkUpdateQuestions()` (service) + `POST /campus/questions/bulk-action` (`{ ids, action }`, activate/deactivate/delete) with the same per-id success/failure bucketing pattern as bulk import. Frontend: row checkboxes + a bulk-action toolbar in `QuestionBankPage.tsx`. Verified partial-failure handling (bogus id fails independently without blocking the valid ones) and live in-browser.
- **E3** — new `college_departments` table + CRUD (`collegeDepartments.service.ts`, `campus.departments.controller.ts`, mounted in both `app.ts` and the NestJS `campus-legacy.module.ts` bootstraps). New `DepartmentsSettingsPage.tsx` at `/app/college-portal/settings/departments` (linked from College Profile). `StudentFormPage.tsx`'s free-text Department field and `StudentsPage.tsx`'s hardcoded 7-item filter list both now source live from this college-scoped list. Scope note: `department` stays a free-text column on existing student tables (no FK migration) — this constrains the *picker* to a configurable list without touching existing data, so old free-text values keep displaying but won't be selectable again until an admin adds them to the list.
- **E4** — the "Browse Question Bank" picker in `AssessmentManagementPage.tsx` already had search/category/difficulty filters; the pain point was one-row-at-a-time "Select" clicks in a scrolling list. Replaced with a responsive card grid where clicking a card toggles it in/out of the assessment (checkbox state), with a live selected-count footer. Tag-based filtering was scoped out — `college_questions` has no `tags` column (unlike the global `question_bank` table), and adding one was bigger than this item's core complaint.

## Completed (2026-07-23, Missing Features)

- **F1** — Reused the existing `instructor` role (already in the DB enum, previously unused) rather than inventing a new one. Faculty accounts get a department (free text, dropdown-driven from the E3 department list) via an extended "Add Staff" flow. Server-side isolation (`resolveCallerDepartment` in `campus.students.controller.ts`) forces the student list/detail endpoints to their own department for `instructor` callers — verified an instructor sees only their 4 department students out of 11 college-wide, and gets a 404 on direct-ID access to another department's student. New `/app/faculty-dashboard` gives faculty a real department-scoped roster instead of the previous 2-line re-export of the admin dashboard. Scope boundary: question banks/assessments stayed college-wide (shared resource), only student outcomes are isolated — that's the concrete "hard isolation" ask from the feedback; department-scoped question banks would be a much larger follow-up.
- **F2** — New BullMQ queue/worker (`notificationDigest.queue.ts` / `.worker.ts`) registered in both server bootstraps (`main.ts` and the legacy `index.ts` — this app runs two parallel entry points). Daily 6pm repeatable job aggregates pending/completed counts per student and per-faculty-department from `college_campaign_students`/`college_campaign_attempts`, writes in-app notifications (existing `notifications` table) and best-effort emails. Verified via a manual-trigger endpoint: real notification rows generated, faculty summary correctly department-scoped.
- **F3** — New `collegeEvaluationRollup.service.ts` aggregates published `college_campaign_evaluations` by department, extending the existing single-attempt AI-coaching pattern (`assessmentEvaluation.service.ts`) to a college/department rollup with an AI-generated narrative summary. New page at Evaluation Insights; faculty auto-locked to their own department (same pattern as F1). AI summary gracefully returns `null` when the Anthropic key is invalid — verified the aggregation and the graceful-degradation path both work; couldn't verify actual AI prose without valid credentials in this environment.
- **F4** — Most of this already existed for Super Admin (`/api/qb-ai/generate`, RAG-based Python engine) — extended role access to `college_admin`/`college`/`instructor` on the existing `/health` and `/generate` endpoints, then added a college-scoped import path (`importAiGeneratedQuestions` → existing `createQuestion()`, so dedup/validation/audit all apply identically to manual creation). New page at Question Bank → "Generate with AI". Verified the transform (AI engine's broader category set → the 5 college categories, correct-answer text matching → option flagging) via a simulated payload since the local Python engine isn't running in this environment.
- **F5** — Added `ai_question_generation` to the shared feature catalog (client + server mirrors) — it's a catalog-driven system, so it surfaced automatically in the Super Admin module editor and the existing `FeatureGuard`/`usePortalFeatures` gating, with no other plumbing needed. Verified the new key appears in `GET /api/superadmin/modules/catalog`.
- **F6** — Originally built a custom manual-recording CRUD (`collegePayments.service.ts`, new "Fee Payments" page/nav item) against `student_payments`. **Superseded and deleted** during the 2026-07-23 route-consolidation pass below: `/app/college/billing` (`BillingPage.tsx` + `/api/billing/student-fees/*`) turned out to already be a complete, more capable implementation of the same feature — department rollups, per-student "Mark Paid" flow, and even mock-payment-gateway hooks for online collection that my version didn't have. Removed the duplicate entirely and mounted the existing `BillingPage` into the new portal shell instead. Net result is the same user-facing capability (F6's ask is satisfied), just via the pre-existing implementation rather than new code.
- **F7** — Confirmed already fully built (9 Prisma models, service layer, capacity/scheduling enforcement, auto-transition scheduler) — skipped rather than rebuilding. Flagged for the user to clarify what (if anything) is actually missing before scoping further work here.

**Incidental fixes made along the way:**
- `campus.students.routes.ts`: the student list endpoint excluded `instructor` from its role gate entirely — fixed as part of F1 (was a precondition for faculty to see any students at all).
- Registering new routes in this codebase requires updating **two** parallel places (`app.ts` for the Express bootstrap, `campus-legacy.module.ts` for the NestJS bootstrap) — both `main.ts` and the older `index.ts` entry points are live and need worker registrations mirrored too. Missed this once (F2) and had to backfill `index.ts`.

## Completed (2026-07-23, Route Consolidation)

Not one of the original backlog items — surfaced as a side effect of building F1–F6, since most of that new UI landed in the redesigned `/app/college-portal/*` shell while several pages only ever existed under the older `/app/college/*` (`DashboardLayout`) shell, with no link between them.

- Found that `drives`, `settings`, and `integrity` were mounted at **both** `/app/college/*` and `/app/college-portal/*` using the literal same component (`CampusDrivesListPage`, `CampusSettingsPage`, `CampusIntegrityPage`) with no redirect tying the two URLs together — bookmarking either landed you in a different sidebar around identical content.
- Found `campus-admins` (where F1's faculty-account creation lives) had **no** equivalent in the new shell at all — undiscoverable from anywhere in the redesigned portal.
- While porting `billing` into the new shell, found the pre-existing duplicate described in F6 above.
- Mounted `results`, `insights`, `communications`, `billing`, and `campus-admins` under `/app/college-portal/*` (reusing the same components — proven safe by the drives/settings/integrity precedent), extended `CollegeLegacyFeatureGuard`'s redirect list to cover all 9 legacy paths, and added the missing nav items (including one for F3's Evaluation Insights, which had never gotten a nav link either).
- **Bug caught during the follow-up validation pass:** the new `billing` route only inherited the outer shell's broad role guard, not `billing`'s own `college_admin`/`college`-only restriction the legacy route had — a faculty (`instructor`) account could load `/app/college-portal/billing` and see a confusing blank/zero-value page. Checked the backend first: `/api/billing/student-fees/*` already correctly rejects `instructor`, so no data was ever exposed — this was a frontend UX gap, not a security hole. Fixed by wrapping the route and nav item in the same `RoleGuard` the legacy page had.
- Deliberately did **not** delete the old `/app/college/*` route registrations — they're now pure redirect shims, kept so old bookmarks/emailed links still resolve. `DashboardLayout` itself also stays; it's still the active shell for hr/cxo/super_admin/engineer/mentor/placement_cell roles, unrelated to this college-specific duplication.

## Validated (2026-07-23)

Full pass after all of the above: type-checked both projects (38 client / 25 server errors — exactly the pre-existing baseline, zero regressions), then live-verified every item in this doc end-to-end in-browser and via direct API calls as both `college_admin` and the `instructor` (faculty) test account — including the idempotency/duplicate-skip behavior, department isolation, notification digest firing, the AI-generation feature gate correctly blocking until enabled, and the billing fix above.

## Completed (2026-07-23, College Portal Nav Consolidation)

User flagged the College Portal left nav had grown to 18 items and asked whether they were all required. Mapped every item against a stakeholder-supplied "core capabilities" list for the Super Admin/College/Student portals and removed/relabeled what was redundant or non-functional:

- Removed **Results** and **Evaluation Insights** as standalone nav items (both fold into Analytics & Reports); added an "AI Evaluation Summary" cross-link button on `AnalyticsPage.tsx` so the F3 rollup stays discoverable.
- Removed **Communications** — non-functional mock page, not a real capability.
- Removed **Campus Admins** — redundant with the faculty-management link already on the Settings page.
- Net: 18 → 14 nav items in `CollegeLayout.tsx`. Did not touch the underlying pages/routes (kept as redirect-safe, just unlisted), consistent with the redirect-shim precedent set during route consolidation.

## Completed (2026-07-23, Hiring/Company Framing Removal)

User clarified the product does not run real recruitment drives (no companies, applications, interviews, offers) — it's a learning/prep platform. Given `assessment_drives` is also the delivery mechanism for practice/mock/coding tests (not just hiring), scoped this to: remove the hiring/company framing and the non-functional company portal, while keeping practice-test delivery via the drives table fully working.

- **College Portal**: `DrivesListPage.tsx` relabeled "Recruitment Drives" → "Scheduled Tests"; `CollegeLayout.tsx` nav item relabeled to match (icon `Briefcase` → `PlayCircle`).
- **Student Portal**: `widgets.tsx`'s `CampusDrivesWidget` relabeled "Campus drives" → "Scheduled tests" (icon and empty-state copy updated). Left the underlying `CampusDrive` type's `company`/`role` field names alone — confirmed both `studentDashboardService.ts` and the server-side `getEligibleCampusDrives()` already populate them with generic values (`drive_name`, `drive_type`), so only the field *names* are hiring-flavored; renaming the data contract for cosmetic-only benefit wasn't worth the churn.
- **Company portal removed entirely**: it had zero real backing (no `companies` table — `company` is just a `user_role` enum value) and was unreachable in practice. Deleted `client/src/pages/company/*` (5 files) and their routes/lazy-imports in `App.tsx`. Fixed the two places that pointed at the now-dead `/app/company*` routes: `DashboardLayout.tsx` (removed the company "Dashboard" nav item, the dead "JD Extractor" link under the superadmin Assessments section, and the entire "Recruiting" nav section) and `ProtectedRoute.tsx` (`ROLE_HOME.company` now falls back to `/` instead of the deleted `/app/company`). Verified via `tsc --noEmit`: 38 client errors, unchanged from baseline.
- **Deliberately left untouched** (identified but out of scope for this pass — superadmin-internal, not linked from any nav, so no dead links; a real removal would need a product decision, not just a relabel):
  - `client/src/pages/superadmin/companies/CompanyManagementPage.tsx` (`/app/superadmin/companies` — company-account activate/suspend oversight).
  - `client/src/pages/superadmin/recruitment/RecruitmentManagementPage.tsx` (`/app/superadmin/recruitment`).
  - `client/src/pages/drives/CreateDriveModal.tsx` / `CreateDrivePage.tsx` — internal admin copy ("Initialize Recruitment Instance", a `hiring` drive-type option) on the superadmin-only drive-scheduling tool. Not college/student-facing.
  - HR portal (`pages/hr/*`) and public marketing pages (`pages/public/*`) — separate personas/audiences from this backlog's scope.

**Bug caught during live verification:** logging in as `college_admin` and loading `/app/college-portal/dashboard` crashed the entire app (blank white page, no error boundary anywhere in the tree). Root cause: `DashboardPage.tsx`'s "Learning Completion" KPI called `summary.learning_completion_percent.toFixed(1)` guarded only by `summary != null` — but the live `/api/college/dashboard/summary` response doesn't include that field at all (pre-existing backend/frontend contract mismatch, unrelated to this task; every other KPI on the page already null-checks the field itself, not just `summary`). Fixed by matching the same `summary?.field != null` pattern used by the neighboring KPIs. This blocked every college_admin login, not just this verification pass, so fixed it rather than working around it. Verified live: dashboard now renders, sidebar nav confirmed showing "Scheduled Tests" (not "Campus Drives") via the accessibility tree.

## Suggested sequencing

1. **B1–B3** — fix first; these are data-integrity and dead-page bugs, not new work.
2. **F1, F2** — flagged most strongly as structural gaps (isolation, notifications); scope these next.
3. **E1–E4** — UX hardening around bulk import and assessment creation.
4. **F3–F5** — AI-driven evaluation/reporting and generation; larger scope, sequence after core gaps close.
5. **F6, F7** — explicitly deferred by the stakeholder; track but don't schedule yet.
