# Wave 1 — AI Validation

## Surfaces

| Surface | UI | API / service |
|---------|----|---------------|
| AI Models / Prompt Manager | `/ai-config`, `?tab=prompts` | `/api/superadmin/ai-services` |
| QB AI Generator | `/question-bank/ai-generator` | `/api/qb-ai/*` |
| Review Queue | `/question-bank/review-queue` | question bank review APIs |
| Content / Voice Generator | `learning-companion/studio` | learning-companion + engine |
| AI Review Center | `learning-companion/review` | companion review |
| Content Improver / Translation / Embeddings | `/ai-studio/*` | content-improver, translator, embeddings |
| Drive AI pool (legacy path) | drive generate | `drive_generation` + Groq |

---

## Config & reliability

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| AI-CFG-01 | Service keys seeded | question_bank, drive_generation, resume_extraction, … | PARTIAL |
| AI-CFG-02 | Test connection action | Success/fail message | BACKLOG |
| AI-CFG-03 | Offline engine banner | Studio shows offline; books path still works | MANUAL |
| AI-CFG-04 | Fallback / retry behavior | Documented per service | BACKLOG |
| AI-CFG-05 | Latency budget for generate | p95 recorded in Wave 2 | BACKLOG |
| AI-CFG-06 | Token/cost logging | Usage endpoint/logs | BACKLOG |

## Question quality (Wave 1 manual sample)

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| AI-Q-01 | Prompt produces on-topic items | Matches requested domain | MANUAL |
| AI-Q-02 | Difficulty / Bloom fields set or classifiable | Metadata present | BACKLOG |
| AI-Q-03 | Duplicate / near-duplicate detection | Similar-question feature or manual | BACKLOG |
| AI-Q-04 | Hallucination / nonsense rejected in review | Reviewer can reject | MANUAL |
| AI-Q-05 | Toxic content filtered or rejected | Policy + review | BACKLOG |
| AI-Q-06 | Consistency across 3 runs (same prompt) | Acceptable variance noted | BACKLOG |

## Hub assemble path (no AI generate)

Assessment Hub Builder sets `auto_generate_pool: false` and seeds from collections — validate AI is **not** required for Path A assemble:

| ID | Check | Status |
|----|-------|--------|
| AI-HUB-01 | Drive from collections succeeds with AI engine offline | PARTIAL |

## Student-facing AI

| ID | Check | Surface | Status |
|----|-------|---------|--------|
| AI-ST-01 | Placement coach page loads | `/placement-coach` | BACKLOG |
| AI-ST-02 | Explain/hint flows safe | voice-tutor / practice | BACKLOG |
