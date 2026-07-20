# WF-PATH-B — Campus Question Bank → Campaign → Student

College-owned assessment loop (separate from platform `question_bank`).

```
Campus QB → College Assessment → Campaign → Student My Assessments → Results
```

**Reference demo:** [COLLEGE_DEMO_GUIDE.md](../../../COLLEGE_DEMO_GUIDE.md)

**Tables:** `college_questions` → `college_assessments` / `college_assessment_questions` → `college_assessment_campaigns` → campaign attempts.

---

## Gates

| Gate | Actor | Action | Where | Pass when | Status |
|------|-------|--------|-------|-----------|--------|
| PB-1 | Faculty / College Admin | Active campus questions | `/college-portal/question-bank` · `/api/campus/questions` | Active rows | MANUAL |
| PB-2 | Faculty | Build + publish assessment | `/assessments` · `/api/campus/assessments` | Published definition ≥1 Q | MANUAL |
| PB-3 | Faculty | Create + publish campaign | `/campaigns` · preview audience | Live window | MANUAL |
| PB-4 | Student | See campaign | `/my-assessments` | Campaign listed | MANUAL |
| PB-5 | Student | Instructions → attempt → submit | my-assessments subroutes | Completed attempt | MANUAL |
| PB-6 | Faculty | Results / analytics / integrity | campaign subpages | Attempts visible | MANUAL |

## Explicit non-goals

- Does not use `/api/drives` or platform collections.
- Platform Review Queue is not a college step.
- Coding items may be `FUTURE_TYPES` in campaign renderer — prefer MCQ for UAT.

## Automation backlog

Add `flow-16-path-b-campus-campaign.spec.ts` under sprint-1a when Path A is green.
