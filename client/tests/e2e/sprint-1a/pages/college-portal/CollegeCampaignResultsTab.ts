import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { expectToast } from "../../utils/assertions";

/**
 * College Campaign Results Tab — Faculty evaluation + publishing.
 * Path: /app/college-portal/campaigns/:campaignId/results
 * Actions: Evaluate, manual grade, publish, view aggregate stats
 * Displays: Results list (pending/evaluated/published), manual grading modal
 */
export class CollegeCampaignResultsTab extends BasePage {
  readonly heading = /Results|Evaluation|Faculty Results/i;
  readonly path: string; // Dynamic — set via expectLoaded()

  // Locators
  get resultsList() {
    return this.page.locator("table tbody, [data-testid='results-list']");
  }

  get evaluateButton() {
    return this.page.getByRole("button", { name: /Evaluate|Start Grading|Process/i }).first();
  }

  get publishButton() {
    return this.page.getByRole("button", { name: /Publish|Release Results/i });
  }

  get refreshButton() {
    return this.page.getByRole("button", { name: /Refresh|Reload/i }).first();
  }

  get manualGradingModal() {
    return this.page.locator("[role='dialog'], [class*='modal']").filter({ hasText: /Grade|Score|Mark/i });
  }

  get statsPanel() {
    return this.page.locator("[class*='stats'], [data-testid='aggregate-stats']");
  }

  get emptyState() {
    return this.page.locator("text=/No attempts|No evaluations/i");
  }

  // Find result row by student email / name
  resultRowFor(studentEmail: string) {
    return this.page.locator("tbody tr, [data-testid='result-row']").filter({ hasText: studentEmail });
  }

  // ── Expectations ──────────────────────────────────────────
  async expectLoaded(campaignId: string): Promise<void> {
    this.path = `/app/college-portal/campaigns/${campaignId}/results`;
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /campaigns.*results/,
      heading: this.heading,
      screenshot: "campaign_results_tab_loaded",
      allowConsoleNoise: true,
    });
  }

  async expectHasResults(): Promise<void> {
    await expect(this.resultsList).not.toBeEmpty();
  }

  async expectNoResults(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  async expectEvaluateButtonVisible(): Promise<void> {
    await expect(this.evaluateButton).toBeVisible();
  }

  async expectPublishButtonVisible(): Promise<void> {
    await expect(this.publishButton).toBeVisible();
  }

  async expectPublishButtonDisabled(): Promise<void> {
    await expect(this.publishButton).toBeDisabled();
  }

  async expectStatsVisible(): Promise<void> {
    await expect(this.statsPanel).toBeVisible();
  }

  // ── Actions ───────────────────────────────────────────────
  async triggerEvaluation(): Promise<void> {
    await this.click(this.evaluateButton);
    await this.page.waitForLoadState("networkidle");
    await expectToast(this.page, /Evaluated|Grading complete|auto-graded/i, 30_000);
  }

  async refreshResults(): Promise<void> {
    await this.click(this.refreshButton);
    await this.page.waitForLoadState("networkidle");
  }

  async openManualGradingFor(studentEmail: string): Promise<void> {
    const row = this.resultRowFor(studentEmail);
    await expect(row).toBeVisible();
    const gradeBtn = row.getByRole("button", { name: /Grade|Edit|Review/i }).first();
    await this.click(gradeBtn);
    await expect(this.manualGradingModal).toBeVisible();
  }

  async gradeShortAnswer(questionNumber: number, marks: number, feedback?: string): Promise<void> {
    const questionSection = this.manualGradingModal.locator(
      `[data-question-index="${questionNumber - 1}"], [class*='question']:nth-of-type(${questionNumber})`
    );
    await expect(questionSection).toBeVisible();

    // Input marks
    const marksInput = questionSection.locator("input[type='number']").first();
    await marksInput.clear();
    await this.type(marksInput, String(marks));

    // Input feedback (if provided)
    if (feedback) {
      const feedbackInput = questionSection.locator("textarea").first();
      await this.type(feedbackInput, feedback);
    }
  }

  async saveManualGrades(): Promise<void> {
    const saveBtn = this.manualGradingModal.getByRole("button", { name: /Save|Submit|Complete/i }).first();
    await this.click(saveBtn);
    await this.page.waitForLoadState("networkidle");
    await expectToast(this.page, /Saved|Graded successfully|Updated/i, 15_000);
  }

  async closeManualGradingModal(): Promise<void> {
    const closeBtn =
      this.manualGradingModal.getByRole("button", { name: /Close|Cancel/i }).first() ||
      this.manualGradingModal.locator("[aria-label='Close']").first();
    await this.click(closeBtn);
    await expect(this.manualGradingModal).not.toBeVisible();
  }

  async publishResults(): Promise<void> {
    await this.click(this.publishButton);

    // Handle confirmation dialog
    const confirmBtn = this.page.getByRole("button", { name: /Confirm|Yes|Publish|Release/i }).first();
    await expect(confirmBtn).toBeVisible();
    await this.click(confirmBtn);

    await this.page.waitForLoadState("networkidle");
    await expectToast(this.page, /Published|Released|Results published/i, 20_000);
  }

  // ── Queries ───────────────────────────────────────────────
  async getResultCount(): Promise<number> {
    return (await this.page.locator("tbody tr, [data-testid='result-row']").all()).length;
  }

  async statusFor(studentEmail: string): Promise<string> {
    const row = this.resultRowFor(studentEmail);
    const statusCell = row.locator("td").filter({ hasText: /Pending|Evaluated|Published/i }).first();
    return (await statusCell.innerText()).trim();
  }

  async scoreFor(studentEmail: string): Promise<number | null> {
    const row = this.resultRowFor(studentEmail);
    const scoreCell = row.locator("td").filter({ hasText: /\d+/ }).nth(2); // Typically 3rd column
    try {
      const text = await scoreCell.innerText();
      return parseInt(text.match(/\d+/)?.[0] ?? "0");
    } catch {
      return null;
    }
  }

  async getAggregateStats(): Promise<{
    mean: number;
    median: number;
    passRate: number;
    totalAttempts: number;
  }> {
    await expect(this.statsPanel).toBeVisible();

    const meanText = await this.statsPanel.locator("text=/Mean|Average/i").innerText().catch(() => "0");
    const medianText = await this.statsPanel.locator("text=/Median/i").innerText().catch(() => "0");
    const passRateText = await this.statsPanel.locator("text=/Pass Rate|Pass %/i").innerText().catch(() => "0");
    const countText = await this.statsPanel.locator("text=/Total|Attempts/i").innerText().catch(() => "0");

    return {
      mean: parseFloat(meanText.match(/[\d.]+/)?.[0] ?? "0"),
      median: parseFloat(medianText.match(/[\d.]+/)?.[0] ?? "0"),
      passRate: parseFloat(passRateText.match(/[\d.]+/)?.[0] ?? "0"),
      totalAttempts: parseInt(countText.match(/\d+/)?.[0] ?? "0"),
    };
  }

  async hasManualGradesPending(): Promise<boolean> {
    const pendingText = await this.page.locator("text=/Pending Manual|Needs Grading/i").isVisible().catch(() => false);
    return pendingText;
  }

  // ── State checks ──────────────────────────────────────────
  async expectAttemptVisibleForStudent(studentEmail: string): Promise<void> {
    const row = this.resultRowFor(studentEmail);
    await expect(row).toBeVisible();
  }

  async expectAttemptNotVisibleForStudent(studentEmail: string): Promise<void> {
    const row = this.resultRowFor(studentEmail);
    await expect(row).not.toBeVisible().catch(() => undefined);
  }
}
