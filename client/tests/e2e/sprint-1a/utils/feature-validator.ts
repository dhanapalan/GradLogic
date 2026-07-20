/**
 * Validates page-specific Learning Hub features against FeatureSpec.
 */
import { Page } from "@playwright/test";
import type { FeatureSpec } from "../data/feature-spec";

export type FeatureCheck = {
  feature: string;
  expected: "present" | "absent";
  actual: "present" | "absent";
  severity: "FAIL" | "WARN" | "PASS";
  detail?: string;
};

async function visible(page: Page, locator: ReturnType<Page["locator"]>): Promise<boolean> {
  const count = await locator.count();
  if (!count) return false;
  return locator.first().isVisible().catch(() => false);
}

async function hasSearch(page: Page, placeholder?: RegExp): Promise<boolean> {
  if (placeholder) {
    const byPh = page.getByPlaceholder(placeholder);
    if (await visible(page, byPh)) return true;
  }
  const generic = page
    .getByRole("searchbox")
    .or(page.locator('input[type="search"]'))
    .or(page.locator('input[placeholder*="Search" i]'))
    .or(page.locator('input[placeholder*="Filter" i]'))
    .or(page.locator('input[placeholder*="Natural language" i]'));
  return visible(page, generic);
}

async function hasButton(page: Page, name: RegExp): Promise<boolean> {
  const btn = page.getByRole("button", { name }).or(page.getByRole("link", { name }));
  return visible(page, btn);
}

async function hasText(page: Page, pattern: RegExp): Promise<boolean> {
  return visible(page, page.getByText(pattern));
}

async function hasAnyHint(page: Page, hints?: RegExp[]): Promise<boolean> {
  if (!hints?.length) {
    // Any meaningful content region
    const body = page.locator("main, [class*='card'], table, article, [role='list'], canvas, svg");
    return (await body.count()) > 0;
  }
  for (const h of hints) {
    if (await hasText(page, h)) return true;
  }
  return false;
}

async function hasFilters(page: Page, hints?: RegExp[]): Promise<boolean> {
  const selects = page.locator("select");
  if ((await selects.count()) > 0) return true;
  const combobox = page.getByRole("combobox");
  if (await visible(page, combobox)) return true;
  if (hints) {
    for (const h of hints) {
      if (await hasText(page, h)) return true;
    }
  }
  return false;
}

async function hasPagination(page: Page): Promise<boolean> {
  return hasButton(page, /Previous|Next|Page\s*\d/i);
}

async function hasSecondaryTabs(page: Page, sample?: RegExp): Promise<boolean> {
  const nav = page.locator("nav a, [role='tab'], nav button");
  if ((await nav.count()) >= 3) {
    if (!sample) return true;
    return hasText(page, sample);
  }
  return sample ? hasText(page, sample) : false;
}

function result(
  feature: string,
  expected: "present" | "absent",
  actual: "present" | "absent",
  soft = false,
  detail?: string
): FeatureCheck {
  const ok = expected === actual;
  return {
    feature,
    expected,
    actual,
    severity: ok ? "PASS" : soft ? "WARN" : expected === "present" ? "FAIL" : "WARN",
    detail,
  };
}

/**
 * Run feature assertions for one page. Does not throw — returns checks for the audit report.
 */
export async function validatePageFeatures(
  page: Page,
  spec: FeatureSpec,
  opts?: { listEmpty?: boolean }
): Promise<FeatureCheck[]> {
  const checks: FeatureCheck[] = [];
  const empty = opts?.listEmpty ?? false;

  if (spec.search) {
    const present = await hasSearch(page, spec.search.placeholder);
    checks.push(
      result(
        "search",
        spec.search.required ? "present" : "absent",
        present ? "present" : "absent",
        !spec.search.required,
        spec.search.placeholder?.toString()
      )
    );
  }

  if (spec.filters) {
    const present = await hasFilters(page, spec.filters.hints);
    checks.push(
      result(
        "filters",
        spec.filters.required ? "present" : "absent",
        present ? "present" : "absent",
        !spec.filters.required
      )
    );
  }

  if (spec.listOrContent) {
    const present = await hasAnyHint(page, spec.listOrContent.hints);
    const emptyOk =
      spec.emptyState?.acceptable &&
      (await hasAnyHint(page, spec.emptyState.hints ?? [/No .+ yet|No .+ match|empty|Coming Soon/i]));
    checks.push(
      result(
        "listOrContent",
        spec.listOrContent.required ? "present" : "absent",
        present || emptyOk ? "present" : "absent",
        false,
        emptyOk ? "empty-state accepted" : undefined
      )
    );
  }

  if (spec.pagination) {
    const present = await hasPagination(page);
    // Pagination may hide when fewer than one page of results
    const soft = spec.pagination.required && empty;
    checks.push(
      result(
        "pagination",
        spec.pagination.required ? "present" : "absent",
        present ? "present" : "absent",
        soft || !spec.pagination.required,
        soft ? "soft: list may be empty" : undefined
      )
    );
  }

  if (spec.create) {
    const present = spec.create.name
      ? await hasButton(page, spec.create.name)
      : await hasButton(page, /Create|Add|New|Generate|Seed/i);
    checks.push(
      result(
        "create",
        spec.create.required ? "present" : "absent",
        present ? "present" : "absent",
        !spec.create.required
      )
    );
  }

  if (spec.secondaryTabs) {
    const present = await hasSecondaryTabs(page, spec.secondaryTabs.sample);
    checks.push(
      result(
        "secondaryTabs",
        spec.secondaryTabs.required ? "present" : "absent",
        present ? "present" : "absent",
        !spec.secondaryTabs.required
      )
    );
  }

  if (spec.rowActions) {
    const present = spec.rowActions.name
      ? await hasButton(page, spec.rowActions.name).catch(async () =>
          hasText(page, spec.rowActions!.name!)
        )
      : false;
    const soft = spec.rowActions.softIfEmpty !== false;
    checks.push(
      result(
        "rowActions",
        spec.rowActions.required ? "present" : "absent",
        present ? "present" : "absent",
        soft || !spec.rowActions.required,
        soft ? "soft: actions appear when rows exist" : undefined
      )
    );
  }

  if (spec.sort) {
    const present = await hasButton(page, /Sort|Order by/i).catch(() => false);
    checks.push(
      result(
        "sort",
        spec.sort.required ? "present" : "absent",
        present ? "present" : "absent",
        !spec.sort.required
      )
    );
  }

  if (spec.exportImport) {
    const present = await hasButton(page, /Export|Import/i);
    checks.push(
      result(
        "exportImport",
        spec.exportImport.required ? "present" : "absent",
        present ? "present" : "absent",
        !spec.exportImport.required
      )
    );
  }

  return checks;
}

export function summarizeFeatureChecks(checks: FeatureCheck[]): {
  pass: number;
  fail: number;
  warn: number;
  issues: string[];
} {
  const pass = checks.filter((c) => c.severity === "PASS").length;
  const fail = checks.filter((c) => c.severity === "FAIL").length;
  const warn = checks.filter((c) => c.severity === "WARN").length;
  const issues = checks
    .filter((c) => c.severity !== "PASS")
    .map(
      (c) =>
        `[${c.severity}] ${c.feature}: expected ${c.expected}, got ${c.actual}` +
        (c.detail ? ` (${c.detail})` : "")
    );
  return { pass, fail, warn, issues };
}
