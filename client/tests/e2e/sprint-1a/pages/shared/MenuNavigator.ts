/**
 * Shared menu navigator — visits each catalog item and asserts portal health.
 */
import { Page, expect } from "@playwright/test";
import { waitForSpinnerGone } from "../utils/assertions";
import { stepScreenshot } from "../utils/interactions";
import type { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";
import type { MenuItem } from "../data/menus";

export type MenuVisitResult = {
  label: string;
  path: string;
  ok: boolean;
  reason?: string;
};

export class MenuNavigator {
  constructor(
    private readonly page: Page,
    private readonly consoleMon: ConsoleMonitor,
    private readonly networkMon: NetworkMonitor
  ) {}

  /**
   * Open a menu route and validate:
   * page loaded · URL · heading (soft) · no auth crash · spinner gone · optional sidebar label
   */
  async visit(item: MenuItem, opts?: { assertSidebar?: boolean }): Promise<MenuVisitResult> {
    await this.page.goto(item.path, { waitUntil: "domcontentloaded" });
    await waitForSpinnerGone(this.page, 20_000).catch(() => undefined);

    // Logged out / forbidden
    if (/\/auth\/login/.test(this.page.url())) {
      return { label: item.label, path: item.path, ok: false, reason: "redirected to login" };
    }
    if (/not-authorized|unauthorized/i.test(this.page.url())) {
      return { label: item.label, path: item.path, ok: false, reason: "not authorized" };
    }

    const blocked = this.page.getByText(/not authorized|access denied|forbidden/i);
    if ((await blocked.count()) > 0 && (await blocked.first().isVisible().catch(() => false))) {
      return { label: item.label, path: item.path, ok: false, reason: "access denied UI" };
    }

    // URL should match path (ignore query order)
    const pathOnly = item.path.split("?")[0];
    expect(this.page.url()).toContain(pathOnly);

    await expect(this.page.locator("body")).toBeVisible();

    // Crash / error boundary
    const crash = this.page.getByText(/Something went wrong|Unexpected Application Error|Cannot read prop/i);
    const crashed = (await crash.count()) > 0 && (await crash.first().isVisible().catch(() => false));
    if (crashed) {
      await stepScreenshot(this.page, `menu_crash_${item.label}`);
      return { label: item.label, path: item.path, ok: false, reason: "error boundary" };
    }

    // Heading — soft for coming-soon pages
    const heading = this.page.getByRole("heading", { name: item.heading }).first();
    const headingVisible = await heading.isVisible().catch(() => false);
    if (!headingVisible && !item.soft) {
      // Fallback: any h1/h2 present
      const anyHeading = this.page.locator("h1, h2").first();
      await expect(anyHeading).toBeVisible({ timeout: 10_000 });
    } else if (headingVisible) {
      await expect(heading).toBeVisible();
    }

    if (opts?.assertSidebar !== false) {
      const link = this.page.getByRole("link", { name: new RegExp(`^${escapeReg(item.label.split(" (")[0])}$`, "i") });
      // Sidebar may hide feature-flagged items — soft check
      if ((await link.count()) > 0) {
        await expect(link.first()).toBeVisible();
      }
    }

    await this.consoleMon.syncUnhandledFromPage().catch(() => undefined);
    await stepScreenshot(this.page, `menu_${item.label}`);

    return { label: item.label, path: item.path, ok: true };
  }

  async visitAll(
    items: MenuItem[],
    opts?: { stopOnFail?: boolean }
  ): Promise<MenuVisitResult[]> {
    const results: MenuVisitResult[] = [];
    for (const item of items) {
      const r = await this.visit(item);
      results.push(r);
      if (!r.ok && opts?.stopOnFail) break;
    }
    return results;
  }

  /** Expand a Super Admin accordion hub if present. */
  async expandHub(hubName: string): Promise<void> {
    const hub = this.page.getByRole("button", { name: new RegExp(hubName, "i") }).first();
    if ((await hub.count()) === 0) return;
    const expanded = await hub.getAttribute("aria-expanded");
    if (expanded === "false" || expanded === null) {
      await hub.click().catch(() => undefined);
    }
  }
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Assert toast or inline validation after invalid submit. */
export async function expectValidationFeedback(page: Page, pattern: RegExp): Promise<void> {
  const toast = page.locator("[role='status'], [class*='toast']").filter({ hasText: pattern });
  const inline = page.getByText(pattern);
  await expect(toast.or(inline).first()).toBeVisible({ timeout: 12_000 });
}
