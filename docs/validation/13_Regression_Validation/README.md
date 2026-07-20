# 13 — Regression Validation

Maps continuous regression packs to npm scripts and workstreams.

## Packs

| Pack | Command (from `client/`) | Covers |
|------|--------------------------|--------|
| Core onboarding | `npm run test:sprint1a` | WF-COLLEGE-ONBOARDING |
| Edge / negative | `npm run test:sprint1a:edge` | Security/feature edges |
| Menus | `npm run test:sprint1a:menus` | UI menus |
| Hub audits | `npm run test:sprint1a:hub-audits` | UI hubs + INT smoke |
| Path A | `npm run test:sprint1a:path-a` | WF-PATH-A |
| Server unit | `cd server && npm run test:unit` | Narrow rules |
| Server tsc | `cd server && npm test` | Typecheck |

## Cadence

| When | Pack |
|------|------|
| Every PR (proposed) | menus + hub-integration smoke + unit |
| Nightly | full `test:sprint1a` + path-a |
| Pre-release | hub-audits + Path A + UAT Wave 1 |
| Post-release | spot COMP-01 + PERF smoke |

## Reliability checks (tie-in)

| ID | Check | Status |
|----|-------|--------|
| REG-REL-01 | Exam autosave survives refresh | BACKLOG |
| REG-REL-02 | Network blip during submit — retry/message | BACKLOG |
| REG-REL-03 | Logging: API errors in `server/logs` | MANUAL |

## Traceability

Update [../TRACEABILITY.md](../TRACEABILITY.md) when adding packs.
