# Sprint 1A — Business Edge Cases

Enterprise negative / boundary specs. **No framework architecture changes** — reuses existing fixtures, POMs, monitors, and assertions.

## Specs

| File | Module |
|------|--------|
| `super-admin-edge.spec.ts` | Super Admin authz / deep links |
| `college-edge-cases.spec.ts` | College create boundaries + nav/network |
| `college-admin-credentials-edge.spec.ts` | Credential generation edges |
| `login-edge-cases.spec.ts` | Login / session / token / concurrent |
| `student-registration-edge.spec.ts` | Student form duplicates & DOB |
| `student-onboarding-edge.spec.ts` | Resume / nav / session / network |

## Run

```bash
cd client
npm run test:sprint1a:edge
```

Dependent cases (expired temp password, onboarding student) need runtime state from happy-path Flows 3/6 or credential edge generation.

## Assertions covered

Validation / toast messages · API status · UI state · console/JS (via existing monitors) · session/token simulation · offline / abort routes
