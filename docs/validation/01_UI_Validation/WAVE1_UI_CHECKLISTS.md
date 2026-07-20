# Wave 1 — UI Checklists

Roles: Super Admin, College Admin, Student.  
Status: `AUTOMATED` | `PARTIAL` | `MANUAL` | `BACKLOG`

---

## A. Organization — Colleges (Super Admin)

| ID | Check | Route | Pass criteria | Status |
|----|-------|-------|---------------|--------|
| UI-COL-01 | Dashboard loads | `/app/superadmin/dashboard` | KPIs/nav visible; no blank crash | AUTOMATED |
| UI-COL-02 | College list | `/app/superadmin/colleges` | Grid/table; search control | AUTOMATED |
| UI-COL-03 | Add College page | `/app/superadmin/colleges/new` | Form + required labels | AUTOMATED |
| UI-COL-04 | Edit College | college detail edit | Fields save; toast | AUTOMATED |
| UI-COL-05 | Deactivate confirmation | list suspend modal | Cancel keeps status; confirm suspends | AUTOMATED |
| UI-COL-06 | Success notification | after create/edit | Toast visible | AUTOMATED |
| UI-COL-07 | Search | colleges list | Filters by name | AUTOMATED |
| UI-COL-08 | Pagination | colleges list | Next/prev or page size if present | PARTIAL |
| UI-COL-09 | Export | colleges list | Control present or N/A documented | BACKLOG |
| UI-COL-10 | Document title format | college pages | `GradLogic \| …` | BACKLOG |
| UI-COL-11 | Breadcrumb | college pages | Present | BACKLOG |

---

## B. Assessment Hub (Super Admin)

| ID | Check | Route | Pass criteria | Status |
|----|-------|-------|---------------|--------|
| UI-AH-01 | Assessment Hub dashboard | `/assessment-hub` | Heading; filters/KPIs | PARTIAL |
| UI-AH-02 | Question Bank Hub | `/question-bank` | Hub tiles/links | PARTIAL |
| UI-AH-03 | QB Browse | `/question-bank/browse` | Search + rows | PARTIAL |
| UI-AH-04 | AI Generator | `/question-bank/ai-generator` | Generator UI loads | PARTIAL |
| UI-AH-05 | Categories | `/question-bank/categories` | Categories UI | PARTIAL |
| UI-AH-06 | Review Queue | `/question-bank/review-queue` | Queue or empty state | PARTIAL |
| UI-AH-07 | Import Books | `/question-bank/import-books` | Import UI | PARTIAL |
| UI-AH-08 | Question Collections | `/question-collections` | List + search | PARTIAL |
| UI-AH-09 | Assessment Builder list | `/drives` | Heading Assessment Builder | PARTIAL |
| UI-AH-10 | New assessment | `/drives/new` | Collections + rule + assemble CTA | PARTIAL |
| UI-AH-11 | Assign Campus | `/drives/:id/assign-campus` | Campus select + Confirm | PARTIAL |
| UI-AH-12 | Templates / Practice / Mock / Coding | respective routes | Page heading loads | PARTIAL |
| UI-AH-13 | Results & Evaluation | `/assessment-results` | List/search | PARTIAL |
| UI-AH-14 | Assessment Analytics | `/analytics/assessments` | Analytics shell | PARTIAL |
| UI-AH-15 | Hub browser titles / breadcrumbs | all AH pages | Expected format | BACKLOG |

---

## C. College portal

| ID | Check | Route | Pass criteria | Status |
|----|-------|-------|---------------|--------|
| UI-CA-01 | Dashboard | `/app/college-portal/dashboard` | Loads | AUTOMATED |
| UI-CA-02 | Students list / new | `/students`, `/students/new` | Grid + form | AUTOMATED |
| UI-CA-03 | Campus Drives list | `/drives` | Shows assigned drives | PARTIAL |
| UI-CA-04 | Question Bank (campus) | `/question-bank` | Campus QB UI | PARTIAL |
| UI-CA-05 | Assessments | `/assessments` | List/create shell | PARTIAL |
| UI-CA-06 | Campaigns | `/campaigns` | List shell | PARTIAL |
| UI-CA-07 | Menu coverage | all CollegeLayout items | `menu-college-admin` | AUTOMATED |
| UI-CA-08 | Coming Soon pages | `/workflows`, `/technical-skills` | Explicit Coming Soon (not crash) | MANUAL |

---

## D. Student portal

| ID | Check | Route | Pass criteria | Status |
|----|-------|-------|---------------|--------|
| UI-ST-01 | Home / dashboard | `/app/student-portal` | Loads | AUTOMATED |
| UI-ST-02 | My Learning | `/my-learning` | Heading; content or empty | PARTIAL |
| UI-ST-03 | Practice | `/practice` | Practice Hub | PARTIAL |
| UI-ST-04 | Tests | `/tests` | Upcoming/past drives | PARTIAL |
| UI-ST-05 | Exam instructions | `/exam/:driveId/instructions` | Agree + Start | PARTIAL |
| UI-ST-06 | Results | `/results` | Results heading | PARTIAL |
| UI-ST-07 | My Assessments | `/my-assessments` | Campaign list (Path B) | MANUAL |
| UI-ST-08 | Menu coverage | StudentPortalLayout | `menu-student` | AUTOMATED |
| UI-ST-09 | Profile | `/profile` | Profile form | PARTIAL |

---

## E. Cross-cutting UI defects (known)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| UI-DEF-01 | Document titles not `GradLogic \| Hub \| Page` | Critical (audit) | BACKLOG |
| UI-DEF-02 | Missing breadcrumbs on hub pages | High | BACKLOG |
| UI-DEF-03 | Assessment Hub search “coming soon” | Medium | BACKLOG |
