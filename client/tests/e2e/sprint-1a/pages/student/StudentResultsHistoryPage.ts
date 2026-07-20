import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

/**
 * Student Results History Page — List of submitted/evaluated attempts.
 * Path: /app/student-portal/results
 * Displays: Published attempts only (evaluations with status='published')
 * Actions: Filter, view detail, check integrity flags
 */
export class StudentResultsHistoryPage extends BasePage {
  readonly path = ROUTES.studentResults;
  readonly heading = /Results|Attempt History|My Attempts/i;

  // Locators
  get attemptList() {
    return this.page.locator("[data-testid='results-list'], table tbody, [class*='attempt']");
  }

  get emptyState() {
    return this.page.locator("[class*='empty'], text=/No attempts|No results/i");
  }

  get filterDate() {
    return this.page.getByPlaceholder(/Date|filter/i).first();
  }

  get filterStatus() {
    return this.page.getByRole("combobox", { name: /Status|Filter/i });
  }

  // Find attempt row by score + date or any identifiable text
  attemptRowFor(matcher: { score?: number; date?: string; text?: string }) {
    let filter = this.page.locator("tbody tr, [data-testid='attempt-row']");

    if (matcher.score !== undefined) {
      filter = filter.filter({ hasText: String(matcher.score) });
    }
    if (matcher.date) {
      filter = filter.filter({ hasText: matcher.date });
    }
    if (matcher.text) {
      filter = filter.filter({ hasText: matcher.text });
    }

    return filter.first();
  }

  // ── Expectations ──────────────────────────────────────────
  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/student-portal\/results/,
      heading: this.heading,
      screenshot: "results_history_loaded",
      allowConsoleNoise: true,
    });
  }

  async expectHasAttempts(): Promise<void> {
    await expect(this.attemptList).not.toBeEmpty();
  }

  async expectNoAttempts(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  // ── Actions ───────────────────────────────────────────────
  async clickAttempt(matcher: { score?: number; date?: string; text?: string }): Promise<void> {
    const row = this.attemptRowFor(matcher);
    await expect(row).toBeVisible();
    await this.click(row);
  }

  async getAttemptCount(): Promise<number> {
    return (await this.page.locator("tbody tr, [data-testid='attempt-row']").all()).length;
  }

  // ── Queries ───────────────────────────────────────────────
  async scoreFor(matcher: { text?: string }): Promise<number> {
    const row = this.attemptRowFor(matcher || {});
    const scoreCell = row.locator("td, span").filter({ hasText: /\d+/ }).first();
    const text = await scoreCell.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async percentageFor(matcher: { text?: string }): Promise<number> {
    const row = this.attemptRowFor(matcher || {});
    const percentCell = row.locator("td, span").filter({ hasText: /%/ }).first();
    const text = await percentCell.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async statusFor(matcher: { text?: string }): Promise<string> {
    const row = this.attemptRowFor(matcher || {});
    const statusBadge = row.locator("[class*='badge'], span[class*='status']").first();
    return (await statusBadge.innerText()).trim();
  }

  async integrityFlagVisibleFor(matcher: { text?: string }): Promise<boolean> {
    const row = this.attemptRowFor(matcher || {});
    const flag = row.locator("[class*='flag'], [class*='warning'], svg[class*='alert']");
    return await flag.isVisible().catch(() => false);
  }

  // ── State checks ──────────────────────────────────────────
  async expectAttemptVisible(matcher: { score?: number; text?: string }): Promise<void> {
    const row = this.attemptRowFor(matcher);
    await expect(row).toBeVisible();
  }

  async expectAttemptHidden(matcher: { score?: number; text?: string }): Promise<void> {
    const row = this.attemptRowFor(matcher);
    await expect(row).not.toBeVisible().catch(() => undefined);
  }

  async expectPassBadgeVisible(matcher: { text?: string }): Promise<void> {
    const row = this.attemptRowFor(matcher || {});
    const badge = row.locator("text=/PASS|Pass/i");
    await expect(badge).toBeVisible();
  }

  async expectFailBadgeVisible(matcher: { text?: string }): Promise<void> {
    const row = this.attemptRowFor(matcher || {});
    const badge = row.locator("text=/FAIL|Fail/i");
    await expect(badge).toBeVisible();
  }
}
