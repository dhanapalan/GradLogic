import { Page, expect, Locator } from "@playwright/test";
import { ConsoleMonitor, NetworkMonitor } from "./monitors";
import { stepScreenshot } from "./interactions";

export type StepValidationOptions = {
  /** Path fragment or full path expected in the URL. */
  urlIncludes?: string | RegExp;
  /** Document title substring (optional — SPA titles vary). */
  titleIncludes?: string | RegExp;
  /** Visible page heading (h1/h2). */
  heading?: string | RegExp;
  /** Breadcrumb text fragment when the layout renders one. */
  breadcrumb?: string | RegExp;
  /** Expected success toast text. */
  successToast?: string | RegExp;
  /** Required controls that must be visible. */
  requiredControls?: Locator[];
  /** API path that must have succeeded (e.g. /auth/login). */
  apiSuccess?: { path: string; method?: string };
  /** Skip console hard-assert (rare flaky pages). */
  allowConsoleNoise?: boolean;
  /** Screenshot label for this business step. */
  screenshot?: string;
};

/**
 * Enterprise step gate — every major business action must pass these checks.
 */
export async function validateStep(
  page: Page,
  consoleMon: ConsoleMonitor,
  networkMon: NetworkMonitor,
  options: StepValidationOptions
): Promise<void> {
  // Page loaded (document ready + no endless spinner overlay)
  await expect(page.locator("body")).toBeVisible();
  await waitForSpinnerGone(page);

  if (options.urlIncludes) {
    await expect(page).toHaveURL(options.urlIncludes);
  }

  if (options.titleIncludes) {
    await expect(page).toHaveTitle(options.titleIncludes);
  }

  if (options.heading) {
    const heading = page.getByRole("heading", { name: options.heading }).first();
    await expect(heading).toBeVisible();
  }

  if (options.breadcrumb) {
    const crumb = page
      .locator("nav[aria-label*='breadcrumb' i], [class*='breadcrumb' i], ol")
      .filter({ hasText: options.breadcrumb })
      .first();
    // Soft: breadcrumb may be absent on some layouts — assert only if present in DOM
    const count = await page
      .locator("nav[aria-label*='breadcrumb' i], [class*='breadcrumb' i]")
      .count();
    if (count > 0) {
      await expect(crumb).toBeVisible();
    }
  }

  if (options.successToast) {
    const toast = page
      .locator("[role='status'], [class*='toast'], [data-sonner-toast]")
      .filter({ hasText: options.successToast })
      .first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
  }

  if (options.requiredControls?.length) {
    for (const control of options.requiredControls) {
      await expect(control).toBeVisible();
    }
  }

  if (options.apiSuccess) {
    networkMon.assertApiSuccess(
      options.apiSuccess.path,
      options.apiSuccess.method ?? "GET"
    );
  }

  if (!options.allowConsoleNoise) {
    consoleMon.assertClean(options.screenshot || options.heading?.toString() || "step");
  }

  if (options.screenshot) {
    await stepScreenshot(page, options.screenshot);
  }
}

/** Wait until common loading indicators are gone. */
export async function waitForSpinnerGone(page: Page, timeout = 30_000): Promise<void> {
  const spinners = page.locator(
    [
      "[aria-label='Signing in']",
      "[aria-busy='true']",
      ".animate-spin",
      "[class*='spinner' i]",
      "text=Please wait…",
      "text=Loading…",
      "text=Loading...",
    ].join(", ")
  );

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const visible = await spinners.evaluateAll((els) =>
      els.some((el) => {
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
      })
    ).catch(() => false);
    if (!visible) return;
    await page.waitForTimeout(200);
  }
}

export async function expectToast(
  page: Page,
  text: string | RegExp,
  timeout = 15_000
): Promise<void> {
  await expect(
    page.locator("[role='status'], [class*='toast']").filter({ hasText: text }).first()
  ).toBeVisible({ timeout });
}
