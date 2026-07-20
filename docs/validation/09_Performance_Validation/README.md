# 09 — Performance Validation

**Wave:** 2 (outline only)  
**Owner:** QA + Backend  
**Entry:** Wave 1 Path A green on staging

## Goals

Measure page load, API latency, and DB query health under normal concurrent use.

## GradLogic scenarios

| ID | Scenario | Target (initial) | Status |
|----|----------|------------------|--------|
| PERF-01 | SA Assessment Hub dashboard TTI | < 3s on staging | BACKLOG |
| PERF-02 | QB browse 1k rows first page | < 2s API p95 | BACKLOG |
| PERF-03 | `POST /drives` assemble from collection | < 5s | BACKLOG |
| PERF-04 | Student exam start session | < 2s | BACKLOG |
| PERF-05 | Exam autosave PUT | < 500ms p95 | BACKLOG |
| PERF-06 | Campus drives list | < 2s | BACKLOG |

## Method

- Browser: Playwright performance helper / Lighthouse spot checks  
- API: k6 or autocannon against staging with auth tokens  
- DB: `EXPLAIN ANALYZE` on drive list / pool join queries  

## Exit

Baselines recorded in this folder; regressions fail CI budget (future).
