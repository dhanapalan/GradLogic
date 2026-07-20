# GradLogic Enterprise UI Validation Report
## Module: Super Admin → Learning Hub

| Field | Value |
|-------|--------|
| **Overall verdict** | **FAIL** |
| Audit type | Static code + route/menu analysis (Phase 1) |
| Live evidence capture | `npm run test:sprint1a` → `learning-hub-audit` (screenshots under `test-results/sprint-1a/learning-hub-audit/`) |
| Fixes applied | **None** (per request — report only) |
| Date | 2026-07-18 |
| Sources | `SuperAdminLayout.tsx`, KL / Course Builder / Catalog / Journey layouts, `App.tsx` routes, `index.html`, client title usage |

---

## 1. Validation Summary (PASS / FAIL)

| Area | Result | Notes |
|------|--------|--------|
| Menu visibility (Learning Hub tree) | **PASS** | Hub + nested Knowledge Library defined in NAV |
| Expand / collapse (hub accordion) | **PASS** | One hub open at a time; nested KL group supported |
| Active leaf highlight | **PASS** (with caveats) | Works; query-string rules special-cased for KL |
| Parent remains expanded on route | **PASS** | `resolveOpenHub` + `openNested` sync from URL |
| Routes exist for listed menus | **PASS** | Wired in `App.tsx` under `/app/superadmin/*` |
| URL correctness | **PASS** | Paths consistent with menu hrefs |
| Breadcrumb | **FAIL** | No breadcrumb component on Learning Hub pages |
| Page title (in-page h1) | **WARN** | Module h1 often fixed (“Knowledge Library”) not page-specific |
| Browser title `GradLogic \| Learning Hub \| <Page>` | **FAIL** | Not implemented for Learning Hub pages |
| Empty / loading states | **WARN** | Loader on KL dashboard; Journey stubs = Coming Soon |
| Permission gates | **WARN** | Mixed `assessments_view` vs `assessments_manage` |
| Duplicate menus | **FAIL** | Multiple duplicate hrefs / labels |
| Module separation (product terminology) | **WARN** | Concepts overlap (Placement Tracks, Skills, Voice) |
| Console / API (live) | **PENDING** | Run audit spec against env |
| Mobile / keyboard / a11y | **WARN** | Mobile drawer exists; no dedicated Learning Hub a11y pass |
| Deep link / refresh / back-forward | **PASS** (expected) | SPA routes; hub re-syncs from location |

**Module overall: FAIL** — must not start new Learning Hub feature work until Critical/High items are addressed.

---

## 2. UI Defects (by priority)

### Critical

| ID | Defect | Evidence |
|----|--------|----------|
| LH-C01 | **Browser title standard not implemented** — Learning Hub pages never set `document.title` to `GradLogic \| Learning Hub \| <Page Name>`. Default remains marketing title from `index.html`: “GradLogic — AI-Powered Talent Development Platform”. | Grep: only Login/Landing set `document.title`; no Super Admin Learning Hub usage |
| LH-C02 | **No breadcrumbs** — Route / menu / page title / browser title cannot be cross-validated. | No breadcrumb usage under `knowledge-library`, `course-builder`, `course-catalog`, `learning-journey` |
| LH-C03 | **Duplicate Learning Hub entries map to same routes** — confuses IA and active-state semantics. | See §6 |

### High

| ID | Defect | Evidence |
|----|--------|----------|
| LH-H01 | **Learning Resources ≡ Documents** — same href `/knowledge-library/assets/documents`. Menu lists both as siblings under Learning Hub. | `SuperAdminLayout.tsx` lines 132 & 149 |
| LH-H02 | **Skills / Topics / Voice Lessons duplicated** — appear under Knowledge Library **and** again as Learning Hub siblings pointing at the same KL paths. | Layout NAV children 134–152 |
| LH-H03 | **Secondary KL tab labels truncated** — “Coding”, “Cases”, “Interview”, “Voice” vs sidebar “Coding Challenges”, “Case Studies”, “Interview Questions”, “Voice Lessons”. Inconsistent naming. | `KnowledgeLibraryLayout.tsx` TABS |
| LH-H04 | **Categories / Subjects / Topics / Skills / Tags / Create Asset missing from KL secondary tab bar** — only in sidebar; Org sub-pages rely on Organization active wildcard. | TABS vs sidebar list |
| LH-H05 | **Page h1 does not change per asset page** — layout always shows “Knowledge Library”; page-specific title not in document title either. | KL layout h1 |
| LH-H06 | **AI Learning Journey largely stubs** — Student Journeys, Placement Tracks, AI Recommendations, Milestones, Progress, Daily Plan, Weekly Goals, Revision, Analytics = Coming Soon. | `JourneyStubs.tsx` |
| LH-H07 | **Permission inconsistency** — KL readable with `assessments_view`; Course Builder / Catalog / Journey need `assessments_manage`. Companion analytics uses `analytics_view`. Operators may see KL but not sibling hubs. | `App.tsx` PermissionGuard |

### Medium

| ID | Defect | Evidence |
|----|--------|----------|
| LH-M01 | **Course Catalog sidebar lands on `/tracks`**, while layout’s “Dashboard” tab is `/course-catalog` — first impression ≠ “Dashboard”. | Menu href vs Catalog TABS |
| LH-M02 | **“Placement Tracks” concept duplicated** — Course Catalog centerpiece **and** Journey stub “Placement Tracks”. | Catalog layout + JourneyStubs |
| LH-M03 | **Learning Companion vs Knowledge Library overlap** — Companion still has categories/subjects/topics/skills routes; KL has Organization taxonomy. Risk of dual masters. | `App.tsx` learning-companion/* vs knowledge-library/organization/* |
| LH-M04 | **Voice Lessons also under Voice Studio hub** — third navigation surface for same asset type. | SuperAdmin NAV Voice Studio |
| LH-M05 | **KL Dashboard loading = spinner only** — no skeleton; empty stats not distinguished from error. | `DashboardPage.tsx` |
| LH-M06 | **No formal breadcrumb trail** like `Learning Hub > Knowledge Library > Lessons`. | Layouts |
| LH-M07 | **Create Asset** not in KL horizontal tabs (CTA button only). | Layout |

### Low

| ID | Defect | Evidence |
|----|--------|----------|
| LH-L01 | Capitalization mix: “AI Features” vs “Enterprise” vs truncated tabs. | TABS |
| LH-L02 | Eyebrow copy “Learning Hub · Core repository” good; not mirrored as browser title. | KL layout |
| LH-L03 | Nested accordion depth (Hub → Knowledge Library → leaf) increases click cost on desktop. | SuperAdminLayout |
| LH-L04 | “Admin Console” subtitle in shell vs required “Learning Hub” in browser title — brand hierarchy unclear. | Sidebar brand block |

---

## 3. UX Improvements

1. Adopt **single primary nav** per capability — remove Learning Hub–level duplicates of KL leaves.
2. Rename **Learning Resources** or remove it; keep **Documents** only (or alias with redirect badge).
3. Align secondary tab labels 1:1 with sidebar labels (full names).
4. Add page-level H1 or sticky context chip: e.g. “Lessons” under Knowledge Library.
5. Implement **skeleton loaders** and explicit empty states with CTA.
6. Surface Journey stub roadmap (what’s live vs planned) on Companion hub (Companion already has capability status — mirror for Journey).
7. Standardize permissions: Learning Hub read vs write matrix documented in UI.

---

## 4. Navigation Improvements

1. Learning Hub children should be **only**: Knowledge Library, AI Learning Companion, Course Builder, Course Catalog, AI Learning Journey — **remove** Skills, Topics, Voice Lessons, Learning Resources from hub root.
2. Keep asset types **only** under Knowledge Library nested group.
3. Add breadcrumbs: `Learning Hub / Knowledge Library / Lessons`.
4. Ensure active highlight distinguishes Documents when opened via either historical “Learning Resources” deep link (single canonical name).
5. Course Catalog menu should either open Dashboard or rename menu to “Placement Tracks”.

---

## 5. Missing Features

| Feature | Notes |
|---------|--------|
| Browser title manager | Required format not present |
| Breadcrumbs | Missing entirely on Learning Hub |
| Journey runtime features | Most Journey tabs are stubs |
| Consistent empty/error pages | Not standardized |
| Export/Import UX parity | Enterprise hub exists; not validated live per page |
| Keyboard nav audit | Not proven for nested accordion + tab strip |
| Dedicated Learning Hub home | No `/learning-hub` landing — jumps into KL or siblings |

---

## 6. Duplicate Features

| Duplicate | Locations | Same route? |
|-----------|-----------|-------------|
| Documents / Learning Resources | KL nested + Learning Hub sibling | **Yes** → `/assets/documents` |
| Skills | KL Organization + Learning Hub sibling | **Yes** |
| Topics | KL Organization + Learning Hub sibling | **Yes** |
| Voice Lessons | KL assets + Learning Hub sibling (+ Voice Studio) | **Yes** (+ Voice Studio) |
| Placement Tracks | Course Catalog vs Journey stub | **Different routes**, same product concept |
| Taxonomy (Categories/Subjects/…) | Companion routes + KL Organization | **Parallel** |

---

## 7. Page Title Issues

| Page | In-page title behavior | Issue |
|------|------------------------|-------|
| All KL asset pages | Parent layout h1 = “Knowledge Library” | Page name not primary H1 |
| Course Builder | h1 = “Course Builder” | OK for module; tab pages don’t change h1 |
| Course Catalog | h1 = “Course Catalog” | OK; tracks page may need “Placement Tracks” as primary |
| Journey | h1 = “AI Learning Journey” | Stub pages use Coming Soon titles inside outlet |
| Companion | Product hub copy | OK as module home |

---

## 8. Browser Title Issues

**Expected:** `GradLogic | Learning Hub | <Page Name>`  
**Actual:** Static `GradLogic — AI-Powered Talent Development Platform` (from `index.html`) for essentially all Learning Hub routes.

| Forbidden pattern | Observed? |
|-------------------|-----------|
| `Dashboard` alone | No (marketing title instead) |
| `Admin Console` alone | No as document.title |
| `React App` | No |
| `Untitled` | No |
| `localhost` | No |

Still **FAIL** against required Learning Hub format.

---

## 9. Route Issues

| Menu label | Route | Status |
|------------|-------|--------|
| KL Dashboard | `/app/superadmin/knowledge-library` | OK |
| All Knowledge … Create Asset | `/knowledge-library/...` | OK |
| AI Learning Companion | `/learning-companion` | OK |
| Course Builder | `/course-builder` | OK |
| Course Catalog | `/course-catalog/tracks` | OK but ≠ catalog dashboard |
| AI Learning Journey | `/learning-journey` | OK |
| Learning Resources | `/knowledge-library/assets/documents` | **Duplicate of Documents** |
| Skills / Topics / Voice (hub root) | KL paths | **Duplicates** |

Deep links and legacy redirects (`library/*` → KL) exist — good.

---

## 10. API Issues

| Finding | Severity | Notes |
|---------|----------|--------|
| KL stats aggregates question-bank + features APIs | Medium | Coupling; failures may empty dashboard |
| Live 404/500/timeout | Pending | Capture via `learning-hub-audit` against target env |
| Unauthorized | Pending | Depends on permission of test user |

---

## 11. Console Issues

| Finding | Severity | Notes |
|---------|----------|--------|
| No page-level title effect | — | N/A |
| Live console.error / unhandledrejection / React | Pending | Audit spec attaches console summary |

---

## Screenshots

**Not embedded in this static report.** Capture with:

```bash
cd client
npm run test:sprint1a:learning-hub-audit
```

Artifacts:
- `test-results/sprint-1a/learning-hub-audit/*.png` — one per menu
- `test-results/sprint-1a/learning-hub-audit/learning-hub-audit.json` — machine-readable PASS/FAIL **including per-page feature checks**
- `test-results/sprint-1a/learning-hub-audit/LEARNING_HUB_FEATURE_AUDIT.md` — human-readable feature matrix

### Feature validation (per page)

The audit no longer only opens the landing URL. For each of the 25 menus it asserts a **page-specific feature matrix** defined in `data/learning-hub-features.ts`:

| Feature | Example pages that require it |
|---------|--------------------------------|
| Search | All Knowledge, asset lists, Collections, Topics |
| Filters | Asset lists, All Knowledge, Collections |
| List / content / tiles | Almost all |
| Pagination | Questions, Coding Challenges |
| Create / Add CTA | Dashboard, Categories, Collections, Course Builder, … |
| Secondary tabs | KL layout, Course Builder, Catalog, Journey |
| Row actions (soft) | Archive / Deactivate when rows exist |
| Must-absent (WARN) | Sort / Export on landings that should not have them |

Duplicate **Learning Resources** is recorded as FAIL (same route as Documents) and feature checks are skipped there.

---

## Menu checklist (Phase 1)

| Menu item | Visible in NAV | Route | Duplicate? | Browser title | Breadcrumb | Verdict |
|-----------|----------------|-------|------------|---------------|------------|---------|
| Knowledge Library → Dashboard | Yes | OK | No | FAIL | FAIL | **FAIL** |
| All Knowledge | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Lessons | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Questions | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Flashcards | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Coding Challenges | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Case Studies | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Interview Questions | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Voice Lessons | Yes | OK | **Yes (hub dup)** | FAIL | FAIL | **FAIL** |
| Videos | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Documents | Yes | OK | **Yes vs Learning Resources** | FAIL | FAIL | **FAIL** |
| Organization | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Categories | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Subjects | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Topics | Yes | OK | **Yes (hub dup)** | FAIL | FAIL | **FAIL** |
| Skills | Yes | OK | **Yes (hub dup)** | FAIL | FAIL | **FAIL** |
| Tags | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Collections | Yes | OK | No | FAIL | FAIL | **FAIL** |
| AI Features | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Enterprise | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Create Asset | Yes | OK | No | FAIL | FAIL | **FAIL** |
| AI Learning Companion | Yes | OK | Partial overlap taxonomy | FAIL | FAIL | **FAIL** |
| Course Builder | Yes | OK | No | FAIL | FAIL | **FAIL** |
| Course Catalog | Yes | OK | Tracks vs Journey | FAIL | FAIL | **FAIL** |
| AI Learning Journey | Yes | OK | Mostly stubs | FAIL | FAIL | **FAIL** |
| Learning Resources | Yes | OK | **Duplicate Documents** | FAIL | FAIL | **FAIL** |

---

## Recommended fix order (do not start until approved)

1. **LH-C01** Document title service for Learning Hub  
2. **LH-C02** Breadcrumbs  
3. **LH-C03 / H01 / H02** Deduplicate NAV  
4. **LH-H03 / H05** Naming + page titles  
5. **LH-H06 / H07** Journey honesty + permissions matrix  
6. Live API/console pass via audit spec  

---

*End of report. No product code was modified for fixes.*
