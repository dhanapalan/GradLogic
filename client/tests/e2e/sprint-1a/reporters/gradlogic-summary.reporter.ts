/**
 * GradLogic Sprint 1A custom reporter —
 * Execution summary, failure summary, screenshot/video/trace links.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

type FailureRow = {
  title: string;
  file: string;
  error: string;
  screenshots: string[];
  videos: string[];
  traces: string[];
};

function collectAttachments(result: TestResult) {
  const screenshots: string[] = [];
  const videos: string[] = [];
  const traces: string[] = [];
  for (const a of result.attachments) {
    const p = a.path || "";
    if (!p) continue;
    if (a.contentType?.includes("image") || /screenshot/i.test(a.name) || /\.png$/i.test(p)) {
      screenshots.push(p);
    } else if (a.contentType?.includes("video") || /\.webm$/i.test(p)) {
      videos.push(p);
    } else if (/trace/i.test(a.name) || /\.zip$/i.test(p)) {
      traces.push(p);
    }
  }
  // Also scan outputDir artifacts beside attachments
  return { screenshots, videos, traces };
}

export default class GradLogicSummaryReporter implements Reporter {
  private startedAt = Date.now();
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private timedOut = 0;
  private failures: FailureRow[] = [];
  private outputDir = "test-results/sprint-1a";

  onBegin(config: FullConfig, _suite: Suite): void {
    this.startedAt = Date.now();
    this.outputDir = config.projects[0]?.outputDir || this.outputDir;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "passed") this.passed++;
    else if (result.status === "skipped") this.skipped++;
    else if (result.status === "timedOut") {
      this.timedOut++;
      this.failed++;
    } else if (result.status === "failed" || result.status === "interrupted") {
      this.failed++;
    }

    if (result.status === "failed" || result.status === "timedOut") {
      const arts = collectAttachments(result);
      this.failures.push({
        title: test.titlePath().join(" › "),
        file: test.location.file,
        error: result.error?.message?.split("\n")[0] || result.status,
        ...arts,
      });
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const durationMs = Date.now() - this.startedAt;
    const summary = {
      status: result.status,
      durationMs,
      durationHuman: `${(durationMs / 1000).toFixed(1)}s`,
      totals: {
        passed: this.passed,
        failed: this.failed,
        skipped: this.skipped,
        timedOut: this.timedOut,
        total: this.passed + this.failed + this.skipped,
      },
      reports: {
        html: "playwright-report/sprint-1a/index.html",
        junit: path.join(this.outputDir, "junit.xml"),
        json: path.join(this.outputDir, "results.json"),
        executionSummary: path.join(this.outputDir, "execution-summary.json"),
        failureSummary: path.join(this.outputDir, "failure-summary.json"),
        failureMarkdown: path.join(this.outputDir, "FAILURES.md"),
      },
      failures: this.failures,
      generatedAt: new Date().toISOString(),
    };

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(this.outputDir, "execution-summary.json"),
      JSON.stringify(summary, null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.join(this.outputDir, "failure-summary.json"),
      JSON.stringify({ failures: this.failures }, null, 2),
      "utf8"
    );

    const md = [
      `# Sprint 1A Failure Summary`,
      ``,
      `Status: **${result.status}** · Duration: ${summary.durationHuman}`,
      `Passed: ${this.passed} · Failed: ${this.failed} · Skipped: ${this.skipped}`,
      ``,
      `## Reports`,
      `- HTML: \`${summary.reports.html}\``,
      `- JUnit: \`${summary.reports.junit}\``,
      `- JSON: \`${summary.reports.json}\``,
      ``,
      ...this.failures.flatMap((f) => [
        `## ${f.title}`,
        ``,
        `- File: \`${f.file}\``,
        `- Error: ${f.error}`,
        ...f.screenshots.map((s) => `- Screenshot: \`${s}\``),
        ...f.videos.map((v) => `- Video: \`${v}\``),
        ...f.traces.map((t) => `- Trace: \`${t}\``),
        ``,
      ]),
    ].join("\n");

    fs.writeFileSync(path.join(this.outputDir, "FAILURES.md"), md, "utf8");

    // Console banner
    // eslint-disable-next-line no-console
    console.log("\n======== Sprint 1A Execution Summary ========");
    // eslint-disable-next-line no-console
    console.log(
      `Status=${result.status} passed=${this.passed} failed=${this.failed} skipped=${this.skipped} duration=${summary.durationHuman}`
    );
    // eslint-disable-next-line no-console
    console.log(`Summary → ${summary.reports.executionSummary}`);
    if (this.failures.length) {
      // eslint-disable-next-line no-console
      console.log(`Failures → ${summary.reports.failureMarkdown}`);
    }
    // eslint-disable-next-line no-console
    console.log("=============================================\n");
  }
}
