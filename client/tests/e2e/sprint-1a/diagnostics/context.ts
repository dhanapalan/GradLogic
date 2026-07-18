/**
 * Per-page diagnostics binding — available to POMs without constructor churn.
 */
import type { Page } from "@playwright/test";
import type { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";
import type { StepLogger } from "../utils/step-logger";
import type { PerformanceCollector } from "../utils/performance";
import type { LifecycleScreenshots } from "../utils/lifecycle-screenshots";

export type Diagnostics = {
  consoleMon: ConsoleMonitor;
  networkMon: NetworkMonitor;
  logger: StepLogger;
  perf: PerformanceCollector;
  shots: LifecycleScreenshots;
};

const STORE = new WeakMap<Page, Diagnostics>();

export function bindDiagnostics(page: Page, diag: Diagnostics): void {
  STORE.set(page, diag);
}

export function getDiagnostics(page: Page): Diagnostics | undefined {
  return STORE.get(page);
}

export function requireDiagnostics(page: Page): Diagnostics {
  const d = STORE.get(page);
  if (!d) throw new Error("Diagnostics not bound to page — use Sprint 1A test fixture");
  return d;
}
