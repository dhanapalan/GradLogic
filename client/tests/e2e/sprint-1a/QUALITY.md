# Sprint 1A — Quality, Stability & Diagnostics

Enterprise enhancements layered onto the existing framework. **Business flow specs are unchanged.**

## What runs automatically

Every test that uses a Sprint 1A POM fixture now:

1. Attaches **ConsoleMonitor** (errors, JS exceptions, unhandled rejections, React/framework signals)
2. Attaches **NetworkMonitor** (4xx/5xx, timeouts, cancels, retries, slow APIs)
3. Writes **step JSONL logs** (timestamp · action · expected · actual · duration)
4. Collects **performance metrics** (login, page load, API)
5. Captures **lifecycle screenshots** (before/after login, nav, save, logout, failure)
6. Records **video + trace** (config: `trace: on`, `video: on`)
7. On teardown: stability gates + attaches console/network/perf summaries to the HTML report

## Softening gates per test

```ts
test.info().annotations.push({ type: "stability", description: "allow-console" });
test.info().annotations.push({ type: "stability", description: "allow-network" });
test.info().annotations.push({ type: "stability", description: "skip-ui-gates" });
```

Or allow a known console warning for one test:

```ts
consoleMon.ignore(/Known third-party warning/);
networkMon.allowFailure(/\/optional-widget/);
```

## Config (`config/quality.config.ts` / env)

| Env | Default | Meaning |
|-----|---------|---------|
| `S1A_FAIL_ON_CONSOLE` | true | Fail on unexpected console/JS/unhandled |
| `S1A_FAIL_ON_NETWORK` | true | Fail on 5xx / hard failures / timeouts |
| `S1A_FAIL_ON_API_4XX` | false | Fail on unexpected API 4xx |
| `S1A_UI_QUALITY_GATES` | true | Broken images, loaders, CSS, icons |
| `S1A_A11Y_CRITICAL` | true | Basic a11y on critical pages |
| `S1A_SLOW_API_MS` | 5000 | Slow API threshold |
| `S1A_LOGIN_BUDGET_MS` | 15000 | Login timing budget |
| `S1A_CONSOLE_IGNORE` | — | Extra ignore regexes joined by `\|\|` |
| `S1A_SOFT_SLOW_API` | true | Slow APIs warn instead of fail |

## Reports

| Artifact | Path |
|----------|------|
| HTML | `playwright-report/sprint-1a/` |
| JUnit | `test-results/sprint-1a/junit.xml` |
| JSON | `test-results/sprint-1a/results.json` |
| Execution summary | `test-results/sprint-1a/execution-summary.json` |
| Failure summary | `test-results/sprint-1a/failure-summary.json` + `FAILURES.md` |
| Step logs | `test-results/sprint-1a/logs/*.jsonl` |
| Lifecycle shots | `test-results/sprint-1a/lifecycle/` |
| Performance | `test-results/sprint-1a/performance/` |
| Video / Trace | under `test-results/sprint-1a/` (per test) |

## New modules (no duplication of flows)

```
config/quality.config.ts
utils/monitors.ts          (enhanced)
utils/step-logger.ts
utils/performance.ts
utils/api-validator.ts
utils/quality-gates.ts
utils/lifecycle-screenshots.ts
diagnostics/context.ts
diagnostics/index.ts
hooks/stability.hooks.ts
helpers/quality-actions.ts
reporters/gradlogic-summary.reporter.ts
```

## Optional helpers in specs

```ts
import { measureSave, measureApi } from "../diagnostics";

await measureSave(page, "create-college", async () => { ... });
await measureApi(page, "login", "/auth/login", "POST", {
  status: [200, 401],
  schema: { accessToken: "string" },
});
```
