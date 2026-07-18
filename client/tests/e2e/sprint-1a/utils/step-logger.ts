/**
 * Structured step logger — timestamp, action, expected, actual, duration.
 */
import fs from "node:fs";
import path from "node:path";
import { QUALITY } from "../config/quality.config";

export type StepLogEntry = {
  ts: string;
  testId?: string;
  action: string;
  expected: string;
  actual: string;
  durationMs: number;
  status: "pass" | "fail" | "info" | "warn";
  meta?: Record<string, unknown>;
};

export class StepLogger {
  readonly entries: StepLogEntry[] = [];
  private readonly filePath: string;

  constructor(private readonly testId: string) {
    const dir = path.join("test-results", "sprint-1a", "logs");
    fs.mkdirSync(dir, { recursive: true });
    const safe = testId.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 100);
    this.filePath = path.join(dir, `${Date.now()}_${safe}.jsonl`);
  }

  async step<T>(
    action: string,
    expected: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.record({
        action,
        expected,
        actual: "OK",
        durationMs: Date.now() - start,
        status: "pass",
        meta,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.record({
        action,
        expected,
        actual: message,
        durationMs: Date.now() - start,
        status: "fail",
        meta,
      });
      throw err;
    }
  }

  info(action: string, expected: string, actual: string, meta?: Record<string, unknown>): void {
    this.record({
      action,
      expected,
      actual,
      durationMs: 0,
      status: "info",
      meta,
    });
  }

  warn(action: string, expected: string, actual: string, meta?: Record<string, unknown>): void {
    this.record({
      action,
      expected,
      actual,
      durationMs: 0,
      status: "warn",
      meta,
    });
  }

  private record(partial: Omit<StepLogEntry, "ts" | "testId">): void {
    if (!QUALITY.stepLogging) return;
    const entry: StepLogEntry = {
      ts: new Date().toISOString(),
      testId: this.testId,
      ...partial,
    };
    this.entries.push(entry);
    const line = JSON.stringify(entry);
    fs.appendFileSync(this.filePath, line + "\n", "utf8");
    const icon =
      entry.status === "pass" ? "✓" : entry.status === "fail" ? "✗" : entry.status === "warn" ? "!" : "·";
    // eslint-disable-next-line no-console
    console.log(
      `[S1A ${entry.ts}] ${icon} ${entry.action} | expected=${entry.expected} | actual=${entry.actual} | ${entry.durationMs}ms`
    );
  }

  path(): string {
    return this.filePath;
  }
}
