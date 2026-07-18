import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sprint 1A — GradLogic College Admin Portal
 * Critical E2E + stability diagnostics (headed Chromium, full artifacts).
 *
 *   npm run test:sprint1a
 *   npm run test:sprint1a:edge
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);
const ARTIFACTS = path.join(__dirname, "test-results", "sprint-1a");
const SUMMARY_REPORTER = path.join(
  __dirname,
  "tests/e2e/sprint-1a/reporters/gradlogic-summary.reporter.ts"
);

export default defineConfig({
  testDir: "./tests/e2e/sprint-1a/specs",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  outputDir: ARTIFACTS,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/sprint-1a" }],
    ["json", { outputFile: path.join(ARTIFACTS, "results.json") }],
    ["junit", { outputFile: path.join(ARTIFACTS, "junit.xml") }],
    [SUMMARY_REPORTER],
  ],
  use: {
    baseURL: BASE_URL,
    ...devices["Desktop Chrome"],
    headless: false,
    launchOptions: {
      slowMo: Number(process.env.SLOW_MO ?? 400),
      args: ["--window-size=1600,900"],
    },
    viewport: { width: 1600, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    /* Full diagnostics artifacts on every run */
    trace: "on",
    video: "on",
    screenshot: "on",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "sprint-1a-chromium",
      use: { ...devices["Desktop Chrome"], channel: undefined },
    },
  ],
  webServer: IS_LOCAL
    ? {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
