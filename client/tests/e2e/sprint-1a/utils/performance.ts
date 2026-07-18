/**
 * Performance metrics collector for Sprint 1A flows.
 */
import fs from "node:fs";
import path from "node:path";
import { QUALITY } from "../config/quality.config";

export type PerfMetric = {
  name: string;
  ms: number;
  budgetMs?: number;
  overBudget: boolean;
  ts: string;
  meta?: Record<string, unknown>;
};

export class PerformanceCollector {
  readonly metrics: PerfMetric[] = [];

  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    budgetMs?: number,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      const ms = Date.now() - start;
      const budget = budgetMs ?? this.defaultBudget(name);
      this.metrics.push({
        name,
        ms,
        budgetMs: budget,
        overBudget: budget !== undefined ? ms > budget : false,
        ts: new Date().toISOString(),
        meta,
      });
    }
  }

  mark(name: string, ms: number, budgetMs?: number, meta?: Record<string, unknown>): void {
    const budget = budgetMs ?? this.defaultBudget(name);
    this.metrics.push({
      name,
      ms,
      budgetMs: budget,
      overBudget: budget !== undefined ? ms > budget : false,
      ts: new Date().toISOString(),
      meta,
    });
  }

  private defaultBudget(name: string): number | undefined {
    const n = name.toLowerCase();
    if (n.includes("login")) return QUALITY.loginBudgetMs;
    if (n.includes("api")) return QUALITY.slowApiMs;
    if (n.includes("page") || n.includes("dashboard") || n.includes("load")) {
      return QUALITY.slowPageMs;
    }
    return undefined;
  }

  overBudget(): PerfMetric[] {
    return this.metrics.filter((m) => m.overBudget);
  }

  writeJson(fileName = "performance.json"): string {
    const dir = path.join("test-results", "sprint-1a", "performance");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, fileName);
    fs.writeFileSync(out, JSON.stringify({ metrics: this.metrics }, null, 2), "utf8");
    return out;
  }
}
