# Hub validation — local browser (2026-07-18)

**Environment:** Vite `http://admin.localhost:5173` · API `http://127.0.0.1:5050` (healthy) · Docker Postgres/Redis up  
**Actor:** Super Admin (`admin@gradlogic.com`) via Cursor built-in browser  
**Scope:** Assessment Hub + AI Studio landings + cross-hub SPOF smoke (read-only)

## Verdict

| Area | Result |
|------|--------|
| Route landings (headings, no crash/5xx UI) | **PASS** |
| Cross-hub SPOF smoke (6 scenarios) | **PASS** |
| Browser title format `GradLogic \| <Hub> \| <Page>` | **FAIL** (all pages use generic product title) |
| Breadcrumbs | **FAIL** (none observed) |
| Full publish→QB→drive mutation E2E | **NOT RUN** (read-only smoke) |

---

## Integration / SPOF smoke

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Assessment Hub pipeline / dashboard | PASS | `/assessment-hub` → h2 **Assessment Dashboard**; filters Domain/Status/Type; KPI cards (Total Assessments **5**, Practice Sets **2**); sidebar Assessment Hub expanded |
| 2 | Question Bank Hub + browse (shared `question_bank`) | PASS | Hub h1 **Question Bank** with Browse/AI Generate tiles; `/browse` → **All Questions**, search present, ~25 rows |
| 3 | Drive builder ↔ questions | PASS | `/drives` → **Assessment Builder** + **New assessment**; `/drives/new` → **New assessment** / “Assemble from Question Collection…” |
| 4 | AI Studio aliases → Learning Companion | PASS | Studio + Review URLs stay on `learning-companion/studio` and `…/review`; Voice uses `?kind=voice_lessons` on same studio |
| 5 | AI Config shared SPOF surface | PASS | `/ai-config` → **Model Settings** with `question_bank` / Provider / API key; `?tab=prompts` → **Prompt Templates** |
| 6 | KL → Assessment Hub hop | PASS | KL **Knowledge Library** + Create Asset; same session returned to Assessment Hub cleanly |

---

## Assessment Hub landings

| Path | Heading | Status |
|------|---------|--------|
| `/assessment-hub` | Assessment Dashboard | PASS |
| `/question-bank` | Question Bank | PASS |
| `/question-bank/browse` | All Questions | PASS |
| `/question-bank/ai-generator` | AI Question Generator | PASS |
| `/question-bank/categories` | Categories & Topics | PASS |
| `/question-bank/review-queue` | Review Queue | PASS |
| `/question-bank/import-books` | Import from Books | PASS |
| `/question-collections` | Question Collections | PASS |
| `/drives` | Assessment Builder | PASS |
| `/drives/new` | New assessment | PASS |
| `/assessment-templates` | Assessment Templates | PASS |
| `/practice-sets` | Practice Sets | PASS |
| `/mock-tests` | Mock Tests | PASS |
| `/coding-assessments` | Coding Assessments | PASS |
| `/assessment-results` | Results & Evaluation | PASS |
| `/analytics/assessments` | Assessment Analytics | PASS |
| `/certificates` | Certificates | PASS |

## AI Studio landings

| Path | Heading | Status |
|------|---------|--------|
| `/learning-companion/studio` | AI Content Studio | PASS (alias) |
| `/learning-companion/studio?kind=voice_lessons` | AI Content Studio | PASS (Voice alias) |
| `/learning-companion/review` | AI Review Center | PASS (alias) |
| `/ai-studio/content-improver` | AI Content Improver | PASS |
| `/ai-studio/translation` | Translation Studio | PASS |
| `/ai-studio/embeddings` | Embedding Manager | PASS |
| `/ai-config` | Model Settings | PASS |
| `/ai-config?tab=prompts` | Prompt Templates | PASS |

---

## Product notes (audit, not blockers for smoke)

1. **Document title** never uses `GradLogic | Assessment Hub | …` / `… | AI Studio | …` — matches Learning Hub Critical FAIL.
2. **No breadcrumbs** on checked pages.
3. Assessment Hub search placeholder: “Search assessments... **(coming soon)**”.
4. Content Studio banner: AI engine offline — generation limited; books path still available.
5. `drive_generation` label not clearly visible in Model Settings snippet ( `question_bank` was); worth a follow-up API/config check if drive AI gen fails.

Screenshot artifact: `hub-validation-assessment-hub.png` (Assessment Dashboard).
