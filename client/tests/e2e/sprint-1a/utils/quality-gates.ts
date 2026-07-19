/**
 * UI quality gates — images, icons, CSS, loaders, basic a11y on critical pages.
 */
import { Page, expect } from "@playwright/test";
import { QUALITY } from "../config/quality.config";
import { waitForSpinnerGone } from "./assertions";
import type { ConsoleMonitor, NetworkMonitor } from "./monitors";

export type QualityGateResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

export async function checkBrokenImages(page: Page): Promise<QualityGateResult> {
  const broken = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    return imgs
      .filter((img) => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith("data:"))
      .map((img) => img.src);
  });
  return {
    name: "no-broken-images",
    ok: broken.length === 0,
    detail: broken.length ? broken.slice(0, 5).join(", ") : undefined,
  };
}

export async function checkMissingIcons(page: Page): Promise<QualityGateResult> {
  // Lucide/SVG icons that failed to render often leave empty svg with 0 size
  const missing = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll("svg"));
    return svgs.filter((svg) => {
      const r = svg.getBoundingClientRect();
      const hasUse = svg.querySelector("use");
      return r.width === 0 && r.height === 0 && !!hasUse;
    }).length;
  });
  return {
    name: "no-missing-icons",
    ok: missing === 0,
    detail: missing ? `${missing} zero-size <svg use> icons` : undefined,
  };
}

export async function checkStylesheetsLoaded(page: Page): Promise<QualityGateResult> {
  const failed = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets);
    const bad: string[] = [];
    for (const s of sheets) {
      try {
        // Accessing cssRules throws for cross-origin; that's OK.
        void s.cssRules;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/Failed to read|cssRules/i.test(msg) && s.href && /localhost|127\.0\.0\.1|gradlogic/i.test(s.href)) {
          bad.push(s.href);
        }
      }
    }
    // Also check link[rel=stylesheet] error state via load
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    for (const link of links) {
      if ((link as unknown as { sheet: null }).sheet === null && link.href) {
        // May still be loading — ignore unless complete document
      }
    }
    return bad;
  });
  return {
    name: "stylesheets-ok",
    ok: failed.length === 0,
    detail: failed.length ? failed.join(", ") : undefined,
  };
}

export async function checkNoStuckLoaders(page: Page): Promise<QualityGateResult> {
  await waitForSpinnerGone(page, 10_000).catch(() => undefined);
  const stuck = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(
        '[aria-busy="true"], .animate-spin, [class*="spinner" i], [class*="loading" i]'
      )
    );
    return nodes.filter((el) => {
      const s = window.getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
    }).length;
  });
  return {
    name: "no-unexpected-loaders",
    ok: stuck === 0,
    detail: stuck ? `${stuck} visible loader(s)` : undefined,
  };
}

/** Lightweight critical-page a11y checks (no external axe dependency required). */
export async function checkBasicA11y(page: Page): Promise<QualityGateResult> {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const imgs = Array.from(document.querySelectorAll("img"));
    for (const img of imgs) {
      if (!img.getAttribute("alt") && !img.getAttribute("aria-hidden")) {
        out.push(`img missing alt: ${img.src?.slice(0, 80)}`);
      }
    }
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const btn of buttons) {
      const name =
        btn.getAttribute("aria-label") ||
        btn.textContent?.trim() ||
        btn.getAttribute("title");
      if (!name) out.push("button missing accessible name");
    }
    const h1 = document.querySelectorAll("h1");
    if (h1.length === 0) {
      // Many GradLogic pages use h2 as primary — soft
      const h2 = document.querySelectorAll("h2");
      if (h2.length === 0) out.push("no h1/h2 landmark heading");
    }
    return out.slice(0, 10);
  });
  return {
    name: "basic-a11y",
    ok: issues.length === 0,
    detail: issues.length ? issues.join("; ") : undefined,
  };
}

export async function runQualityGates(
  page: Page,
  opts?: { a11y?: boolean; soft?: boolean }
): Promise<QualityGateResult[]> {
  if (!QUALITY.runUiQualityGates) return [];

  const results: QualityGateResult[] = [
    await checkBrokenImages(page),
    await checkMissingIcons(page),
    await checkStylesheetsLoaded(page),
    await checkNoStuckLoaders(page),
  ];

  const url = page.url();
  const isCritical = QUALITY.criticalA11yPaths.some((p) => url.includes(p));
  if ((opts?.a11y ?? QUALITY.runA11yOnCritical) && isCritical) {
    results.push(await checkBasicA11y(page));
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length && !opts?.soft) {
    throw new Error(
      `[QualityGates] Failed:\n` +
        failed.map((f) => `- ${f.name}: ${f.detail || "failed"}`).join("\n")
    );
  }
  return results;
}

/** Composite end-of-test stability assertion. */
export async function assertTestStability(
  page: Page,
  consoleMon: ConsoleMonitor,
  networkMon: NetworkMonitor,
  context: string,
  opts?: { skipNetwork?: boolean; skipConsole?: boolean; skipUi?: boolean; softUi?: boolean }
): Promise<void> {
  await consoleMon.syncUnhandledFromPage().catch(() => undefined);

  if (!opts?.skipConsole) {
    consoleMon.assertClean(context);
  }
  if (!opts?.skipNetwork) {
    networkMon.assertStable(context);
  }
  if (!opts?.skipUi && QUALITY.runUiQualityGates) {
    await runQualityGates(page, { soft: opts?.softUi ?? true });
  }
}
