/**
 * Sprint 1A — quality / stability thresholds (env-overridable).
 */
function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function envNum(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
}

/** Extra console ignore patterns from env (comma-separated regex sources). */
function envIgnorePatterns(): RegExp[] {
  const raw = process.env.S1A_CONSOLE_IGNORE || "";
  if (!raw.trim()) return [];
  return raw
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new RegExp(s, "i"));
}

export const QUALITY = {
  /** Fail tests on unexpected console.error / pageerror / unhandledrejection. */
  failOnConsoleErrors: envBool("S1A_FAIL_ON_CONSOLE", true),
  /** Fail on unexpected HTTP 5xx / failed / timed-out API calls. */
  failOnNetworkErrors: envBool("S1A_FAIL_ON_NETWORK", true),
  /** Fail on HTTP 4xx for /api/ (except allowlisted). */
  failOnApi4xx: envBool("S1A_FAIL_ON_API_4XX", false),
  /** Run UI quality gates (images, loaders, basic a11y) after each test. */
  runUiQualityGates: envBool("S1A_UI_QUALITY_GATES", true),
  /** Run critical-page accessibility checks when URL matches. */
  runA11yOnCritical: envBool("S1A_A11Y_CRITICAL", true),
  /** API response slower than this (ms) is flagged as slow. */
  slowApiMs: envNum("S1A_SLOW_API_MS", 5_000),
  /** Page load / navigation slower than this is flagged. */
  slowPageMs: envNum("S1A_SLOW_PAGE_MS", 8_000),
  /** Login action budget (ms). */
  loginBudgetMs: envNum("S1A_LOGIN_BUDGET_MS", 15_000),
  /** Soft-warn instead of fail for slow APIs when true. */
  softSlowApi: envBool("S1A_SOFT_SLOW_API", true),
  /** Capture lifecycle screenshots automatically. */
  lifecycleScreenshots: envBool("S1A_LIFECYCLE_SHOTS", true),
  /** Write step JSONL logs under test-results. */
  stepLogging: envBool("S1A_STEP_LOGGING", true),

  /** Built-in + env console ignore patterns. */
  consoleIgnore: [
    /Download the React DevTools/i,
    /\[vite\]/i,
    /favicon\.ico/i,
    /ResizeObserver loop/i,
    /Failed to load resource: net::ERR_CONNECTION_REFUSED/i,
    // Chrome logs this automatically for ANY non-2xx XHR/fetch response —
    // it's not an app/JS error, just browser devtools noise for HTTP status.
    // Negative-path tests (wrong password, corrupt token, validation 4xx)
    // intentionally trigger these; NetworkMonitor's own api4xxAllow/status
    // assertions are the correct place to gate on expected vs. unexpected
    // status codes, not this console-level duplicate.
    /Failed to load resource: the server responded with a status of/i,
    /Third-party cookie will be blocked/i,
    /Non-Error promise rejection captured/i,
    ...envIgnorePatterns(),
  ] as RegExp[],

  /** Network URL patterns that may fail without failing the suite. */
  networkAllowFailures: [
    /\/favicon\.ico/i,
    /hot-update/i,
    /sockjs-node/i,
    /__vite/i,
    /chrome-extension:/i,
    /googletagmanager/i,
    /google-analytics/i,
    /sentry\.io/i,
  ] as RegExp[],

  /** Expected 4xx endpoints (auth failures, validation) — not suite failures. */
  api4xxAllow: [
    /\/auth\/login/i,
    /\/auth\/setup-password/i,
    /\/auth\/forgot-password/i,
  ] as RegExp[],

  /** Critical pages for a11y spot-checks (URL substrings). */
  criticalA11yPaths: [
    "/auth/login",
    "/app/superadmin/dashboard",
    "/app/college-portal/dashboard",
    "/app/student-portal",
    "/student-onboarding",
  ],
} as const;

export type QualityConfig = typeof QUALITY;
