/**
 * Shared hub audit runner — landing + per-page feature matrix + artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { Page, TestInfo, expect } from "@playwright/test";
import type { HubPageFeatures } from "../data/feature-spec";
import {
  validatePageFeatures,
  summarizeFeatureChecks,
  type FeatureCheck,
} from "./feature-validator";
import { waitForSpinnerGone } from "./assertions";
import type { ConsoleMonitor, NetworkMonitor } from "./monitors";

export type HubAuditRow = {
  id: string;
  label: string;
  path: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  documentTitle: string;
  expectedBrowserTitle: string;
  heading?: string;
  url: string;
  issues: string[];
  featureChecks: FeatureCheck[];
  featureSummary?: { pass: number; fail: number; warn: number };
  screenshot?: string;
  duplicateOf?: string;
  aliasOf?: string;
};

export type HubAuditOptions = {
  hubKey: string;
  hubTitle: string; // e.g. "Assessment Hub"
  catalog: HubPageFeatures[];
  page: Page;
  consoleMon: ConsoleMonitor;
  networkMon: NetworkMonitor;
  testInfo: TestInfo;
  /** If true, missing browser-title format is WARN not FAIL (until title system ships). */
  softBrowserTitle?: boolean;
};

export async function runHubFeatureAudit(opts: HubAuditOptions): Promise<{
  rows: HubAuditRow[];
  summary: Record<string, unknown>;
  outDir: string;
}> {
  const {
    hubKey,
    hubTitle,
    catalog,
    page,
    consoleMon,
    networkMon,
    testInfo,
    softBrowserTitle = true,
  } = opts;

  const outDir = path.join("test-results", "sprint-1a", `${hubKey}-audit`);
  fs.mkdirSync(outDir, { recursive: true });
  const rows: HubAuditRow[] = [];

  for (const item of catalog) {
    const issues: string[] = [];
    const expectedBrowserTitle = `GradLogic | ${hubTitle} | ${item.pageName}`;

    if (item.duplicateOf && !item.features?.listOrContent) {
      // Pure duplicate marker (Learning Resources style)
      rows.push({
        id: item.id,
        label: item.label,
        path: item.path,
        status: "FAIL",
        documentTitle: "",
        expectedBrowserTitle,
        url: item.path,
        issues: [
          `Duplicate / alias of "${item.duplicateOf}". Feature checks skipped.`,
          ...(item.aliasOf ? [`Alias note: ${item.aliasOf}`] : []),
        ],
        featureChecks: [],
        duplicateOf: item.duplicateOf,
        aliasOf: item.aliasOf,
      });
      continue;
    }

    await page.goto(item.path, { waitUntil: "domcontentloaded" });
    await waitForSpinnerGone(page, 15_000).catch(() => undefined);
    await page.waitForTimeout(350);

    const documentTitle = await page.title();
    const url = page.url();
    const headingText =
      (await page.locator("h1").first().textContent().catch(() => null))?.trim() ||
      (await page.locator("h2").first().textContent().catch(() => null))?.trim() ||
      undefined;

    if (!new RegExp(`GradLogic \\| ${hubTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`).test(documentTitle)) {
      const msg = `Browser title: got "${documentTitle}", expected format "${expectedBrowserTitle}"`;
      issues.push(softBrowserTitle ? `[WARN] ${msg}` : `Browser title FAIL: ${msg}`);
    }

    const crumb = page.locator("nav[aria-label*='breadcrumb' i], [class*='breadcrumb' i]");
    if ((await crumb.count()) === 0) {
      issues.push("[WARN] Breadcrumb missing");
    }

    const pathOnly = item.path.split("?")[0];
    if (!url.includes(pathOnly)) {
      issues.push(`URL mismatch: ${url}`);
    }

    const headingOk = await page
      .getByRole("heading", { name: item.expectedHeading })
      .first()
      .isVisible()
      .catch(() => false);
    if (!headingOk) {
      issues.push(`Page heading not matching ${item.expectedHeading}`);
    }

    if (item.aliasOf) {
      issues.push(`[INFO] Menu alias → ${item.aliasOf}`);
    }

    await consoleMon.syncUnhandledFromPage().catch(() => undefined);
    const cons = consoleMon.errors();
    if (cons.length) {
      issues.push(`Console errors: ${cons.slice(0, 3).map((e) => e.text).join(" | ")}`);
    }
    const net = networkMon.stabilitySummary();
    if (net.http5xx > 0) issues.push(`HTTP 5xx count=${net.http5xx}`);
    if (net.timeouts > 0) issues.push(`Timeouts count=${net.timeouts}`);

    const emptyHint = await page
      .getByText(/No .+ yet|No .+ match|Coming Soon|empty|No pending/i)
      .first()
      .isVisible()
      .catch(() => false);

    const featureChecks = await validatePageFeatures(page, item.features, {
      listEmpty: emptyHint,
    });
    const featureSummary = summarizeFeatureChecks(featureChecks);
    issues.push(...featureSummary.issues);

    const shot = path.join(outDir, `${String(rows.length + 1).padStart(2, "0")}_${item.id}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);

    const hardFail =
      featureSummary.fail > 0 ||
      issues.some((i) => /URL mismatch|5xx|Console errors|Browser title FAIL|heading not matching/i.test(i));

    rows.push({
      id: item.id,
      label: item.label,
      path: item.path,
      status: hardFail ? "FAIL" : issues.some((i) => /\[WARN\]|expected/.test(i)) || featureSummary.warn > 0 ? "WARN" : "PASS",
      documentTitle,
      expectedBrowserTitle,
      heading: headingText,
      url,
      issues,
      featureChecks,
      featureSummary,
      screenshot: shot,
      duplicateOf: item.duplicateOf,
      aliasOf: item.aliasOf,
    });
  }

  const summary = {
    hubKey,
    hubTitle,
    total: rows.length,
    pass: rows.filter((r) => r.status === "PASS").length,
    warn: rows.filter((r) => r.status === "WARN").length,
    fail: rows.filter((r) => r.status === "FAIL").length,
    featureFailTotal: rows.reduce((n, r) => n + (r.featureSummary?.fail ?? 0), 0),
    featureWarnTotal: rows.reduce((n, r) => n + (r.featureSummary?.warn ?? 0), 0),
    overall: rows.some((r) => r.status === "FAIL") ? "FAIL" : rows.some((r) => r.status === "WARN") ? "WARN" : "PASS",
  };

  const reportPath = path.join(outDir, `${hubKey}-audit.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2),
    "utf8"
  );

  const md = [
    `# ${hubTitle} — Menu + Feature Audit`,
    ``,
    `Overall: **${summary.overall}** · Pages: ${summary.total} · FAIL: ${summary.fail} · WARN: ${summary.warn} · PASS: ${summary.pass}`,
    ``,
    ...rows.flatMap((r) => [
      `## ${r.label} — ${r.status}`,
      `- Path: \`${r.path}\``,
      `- Title: \`${r.documentTitle}\``,
      ...(r.aliasOf ? [`- Alias: ${r.aliasOf}`] : []),
      ...(r.screenshot ? [`- Screenshot: \`${r.screenshot}\``] : []),
      `### Features`,
      ...(r.featureChecks.length
        ? r.featureChecks.map(
            (c) =>
              `- **${c.feature}**: ${c.severity} (expected ${c.expected}, got ${c.actual})`
          )
        : ["- _(skipped)_"]),
      `### Issues`,
      ...(r.issues.length ? r.issues.map((i) => `- ${i}`) : ["- none"]),
      ``,
    ]),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `${hubKey.toUpperCase()}_FEATURE_AUDIT.md`), md, "utf8");

  await testInfo.attach(`${hubKey}-audit.json`, { path: reportPath, contentType: "application/json" });

  expect(rows.length).toBe(catalog.length);
  return { rows, summary, outDir };
}
