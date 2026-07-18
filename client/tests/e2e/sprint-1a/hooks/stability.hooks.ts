/**
 * Stability hooks — import from fixtures; attach afterEach quality gates.
 * Specs can annotate to soften gates:
 *   test.info().annotations.push({ type: 'stability', description: 'allow-console' })
 *   test.info().annotations.push({ type: 'stability', description: 'allow-network' })
 *   test.info().annotations.push({ type: 'stability', description: 'skip-ui-gates' })
 */
import type { TestInfo } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";
import { assertTestStability } from "../utils/quality-gates";
import type { StepLogger } from "../utils/step-logger";
import type { PerformanceCollector } from "../utils/performance";
import type { LifecycleScreenshots } from "../utils/lifecycle-screenshots";

function hasAnnotation(testInfo: TestInfo, description: string): boolean {
  return testInfo.annotations.some(
    (a) => a.type === "stability" && (a.description || "").includes(description)
  );
}

export async function runStabilityTeardown(opts: {
  page: Page;
  testInfo: TestInfo;
  consoleMon: ConsoleMonitor;
  networkMon: NetworkMonitor;
  logger: StepLogger;
  perf: PerformanceCollector;
  shots: LifecycleScreenshots;
}): Promise<void> {
  const { page, testInfo, consoleMon, networkMon, logger, perf, shots } = opts;

  if (testInfo.status !== "passed" && testInfo.status !== "skipped") {
    await shots.capture(page, "on-failure", testInfo.title);
  }

  // Attach diagnostics to the HTML report
  const consoleSummary = consoleMon.summary();
  const netSummary = networkMon.stabilitySummary();
  await testInfo.attach("console-summary.json", {
    body: Buffer.from(JSON.stringify(consoleSummary, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach("network-summary.json", {
    body: Buffer.from(JSON.stringify(netSummary, null, 2)),
    contentType: "application/json",
  });
  if (perf.metrics.length) {
    const perfPath = perf.writeJson(
      `${testInfo.testId.replace(/[^a-zA-Z0-9-_]/g, "_")}.json`
    );
    await testInfo.attach("performance.json", {
      path: perfPath,
      contentType: "application/json",
    });
  }
  await testInfo.attach("step-log.jsonl", {
    path: logger.path(),
    contentType: "application/x-ndjson",
  }).catch(() => undefined);

  // Only enforce hard gates on passed tests (don't mask original failure)
  if (testInfo.status === "passed" || testInfo.status === undefined) {
    await assertTestStability(page, consoleMon, networkMon, testInfo.title, {
      skipConsole: hasAnnotation(testInfo, "allow-console"),
      skipNetwork: hasAnnotation(testInfo, "allow-network"),
      skipUi: hasAnnotation(testInfo, "skip-ui-gates"),
      softUi: true,
    });
  }

  logger.info(
    "stability.teardown",
    "console+network+ui gates complete",
    JSON.stringify({ consoleSummary, netSummary, status: testInfo.status })
  );
}
