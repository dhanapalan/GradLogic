import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";

/**
 * Student Results Detail Page — Question-level results + marks + feedback.
 * Path: /app/student-portal/results/:attemptId or /app/student-portal/results/report/:attemptId
 * Displays: Score header, question table with marks + feedback, integrity notice (if flagged)
 */
export class StudentResultsDetailPage extends BasePage {
  readonly heading = /Results|Report|Attempt Report|Scores and Feedback/i;
  readonly path: string; // Dynamic — set via expectLoaded()

  // Locators
  get scoreDisplay() {
    return this.page.locator("[class*='score'], [data-testid='score'], text=/^\d+(\.\d+)?$/").first();
  }

  get percentageDisplay() {
    return this.page.locator("[class*='percentage'], text=/%/").first();
  }

  get passFailBadge() {
    return this.page.locator("[class*='badge'], span[class*='status']").filter({ hasText: /PASS|FAIL/i }).first();
  }

  get questionTable() {
    return this.page.locator("table tbody, [data-testid='questions-list'], [class*='question']");
  }

  get integrityNotice() {
    return this.page.locator("[class*='integrity'], [class*='warning'], [role='alert']").filter({
      hasText: /integrity|concern|violation|flag/i,
    });
  }

  get backButton() {
    return this.page.getByRole("button", { name: /Back|Return/i }).first();
  }

  // ── Expectations ──────────────────────────────────────────
  async expectLoaded(attemptId: string): Promise<void> {
    this.path = `/app/student-portal/results/report/${attemptId}`;
    await this.waitLoaded();
    await this.validate({
      urlIncludes: new RegExp(`results.*${attemptId}`),
      heading: this.heading,
      screenshot: "results_detail_loaded",
      allowConsoleNoise: true,
    });
  }

  async expectScoreVisible(): Promise<void> {
    await expect(this.scoreDisplay).toBeVisible();
  }

  async expectIntegrityNoticeVisible(): Promise<void> {
    await expect(this.integrityNotice).toBeVisible();
  }

  async expectIntegrityNoticeHidden(): Promise<void> {
    await expect(this.integrityNotice).not.toBeVisible().catch(() => undefined);
  }

  async expectQuestionsTableVisible(): Promise<void> {
    await expect(this.questionTable).toBeVisible();
  }

  // ── Queries ───────────────────────────────────────────────
  async getScore(): Promise<number> {
    await expect(this.scoreDisplay).toBeVisible();
    const text = await this.scoreDisplay.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getPercentage(): Promise<number> {
    const text = await this.percentageDisplay.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getPassFail(): Promise<"PASS" | "FAIL"> {
    const text = await this.passFailBadge.innerText();
    return /PASS/i.test(text) ? "PASS" : "FAIL";
  }

  async getIntegrityRiskLevel(): Promise<"low" | "medium" | "high" | null> {
    const text = await this.integrityNotice.innerText().catch(() => "");
    if (/high|critical/i.test(text)) return "high";
    if (/medium/i.test(text)) return "medium";
    if (/low/i.test(text)) return "low";
    return null;
  }

  // ── Question-level queries ────────────────────────────────
  async getQuestionCount(): Promise<number> {
    return (await this.page.locator("tbody tr, [data-testid='question-row']").all()).length;
  }

  questionRowFor(index: number) {
    return this.page.locator("tbody tr, [data-testid='question-row']").nth(index);
  }

  async getQuestionText(index: number): Promise<string> {
    const row = this.questionRowFor(index);
    return (await row.locator("td").first().innerText()).trim();
  }

  async getQuestionType(index: number): Promise<string> {
    const row = this.questionRowFor(index);
    const typeCell = row.locator("td").filter({ hasText: /MCQ|Short Answer|True\/False/i }).first();
    return (await typeCell.innerText()).trim();
  }

  async getMarksAwarded(index: number): Promise<number> {
    const row = this.questionRowFor(index);
    const marksCell = row
      .locator("td, span")
      .filter({ hasText: /\d+\s*\/\s*\d+|marks/ })
      .first();
    const text = await marksCell.innerText();
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async getMarksTotal(index: number): Promise<number> {
    const row = this.questionRowFor(index);
    const marksCell = row
      .locator("td, span")
      .filter({ hasText: /\d+\s*\/\s*\d+|marks/ })
      .first();
    const text = await marksCell.innerText();
    const match = text.match(/\d+\s*\/\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async isCorrect(index: number): Promise<boolean> {
    const row = this.questionRowFor(index);
    const checkmark = row.locator("svg[class*='check'], text=✓").first();
    return await checkmark.isVisible().catch(() => false);
  }

  async isIncorrect(index: number): Promise<boolean> {
    const row = this.questionRowFor(index);
    const xmark = row.locator("svg[class*='x'], svg[class*='close'], text=✕").first();
    return await xmark.isVisible().catch(() => false);
  }

  async getFeedback(index: number): Promise<string> {
    const row = this.questionRowFor(index);
    const feedbackCell = row.locator("td").filter({ hasText: /feedback|explanation|note/i }).first();
    return (await feedbackCell.innerText()).trim().substring(0, 200);
  }

  async hasNegativeMarks(index: number): Promise<boolean> {
    const row = this.questionRowFor(index);
    const marksCell = row.locator("td, span").filter({ hasText: /-\d+|negative/ });
    return await marksCell.isVisible().catch(() => false);
  }

  // ── Navigation ────────────────────────────────────────────
  async goBack(): Promise<void> {
    await this.click(this.backButton);
  }
}
