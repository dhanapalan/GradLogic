# Hub audits — Learning · Assessment · AI Studio · Integration

## Scope

| Suite | Catalog | Command |
|-------|---------|---------|
| Learning Hub | `data/learning-hub-features.ts` | `npm run test:sprint1a:learning-hub-audit` |
| Assessment Hub | `data/assessment-hub-features.ts` | `npm run test:sprint1a:assessment-hub-audit` |
| AI Studio | `data/ai-studio-features.ts` | `npm run test:sprint1a:ai-studio-audit` |
| Cross-hub SPOF smoke | `specs/audit/hub-integration-smoke.spec.ts` | `npm run test:sprint1a:hub-integration` |

Each menu audit:
1. Opens the landing URL  
2. Checks title / heading / breadcrumb / console / 5xx  
3. Runs a **page-specific** feature matrix (search, filters, list, pagination, create, tabs, …)  
4. Writes JSON + markdown + screenshots under `test-results/sprint-1a/<hub>-audit/`

## Integration / SPOF coverage

| Test | Risk covered |
|------|----------------|
| Assessment Hub pipeline dashboard | `assessmentPipeline.service` catalogSteps (KL → QB → collections → drives → journeys) |
| Question Bank browse | Shared `question_bank` surface used by drives |
| Drive create builder | Drive UI still references questions/collections/rules |
| AI Studio studio/review URLs | Aliases into `learning-companion/*` (not a separate pipeline) |
| AI Config providers | Shared SPOF (`question_bank`, `drive_generation`, …) |
| KL → Assessment Hub hop | Session still can traverse Learning → Assessment |

## Full publish→drive E2E (recommended next)

Not automated as a mutating flow yet (needs `ADMIN_ALLOW_MUTATIONS` + seeded data). Target flow:

1. Publish question in Knowledge Library / Question Bank  
2. Verify visible in Question Bank Hub browse  
3. Create/edit drive and select that question  
4. Assert drive detail includes `question_id` from shared `question_bank`
