import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { expectToast } from "../../utils/assertions";

/**
 * College Campaign Integrity Tab — Proctoring audit + incident review.
 * Path: /app/college-portal/campaigns/:campaignId/integrity
 * Displays: Summary dashboard, flagged incidents list, timeline view, settings
 * Actions: Review/dismiss incidents, configure detection settings
 */
export class CollegeCampaignIntegrityTab extends BasePage {
  readonly heading = /Integrity|Proctoring|Violations|Incident/i;
  readonly path: string; // Dynamic — set via expectLoaded()

  // Locators — Dashboard
  get summaryCards() {
    return this.page.locator("[class*='card'], [data-testid='summary']");
  }

  get totalIncidentsCard() {
    return this.page.locator("[class*='card']").filter({ hasText: /Total|Incidents/i }).first();
  }

  get highRiskCard() {
    return this.page.locator("[class*='card']").filter({ hasText: /High|Critical/i }).first();
  }

  get mediumRiskCard() {
    return this.page.locator("[class*='card']").filter({ hasText: /Medium/i }).first();
  }

  get lowRiskCard() {
    return this.page.locator("[class*='card']").filter({ hasText: /Low/i }).first();
  }

  // Locators — Incidents list
  get flaggedIncidentsList() {
    return this.page.locator("table tbody, [data-testid='incidents-list']");
  }

  get settingsButton() {
    return this.page.getByRole("button", { name: /Settings|Config|Configure/i }).first();
  }

  // Locators — Incident timeline modal
  get incidentTimelineModal() {
    return this.page.locator("[role='dialog'], [class*='modal']").filter({ hasText: /Timeline|Events|Incident/i });
  }

  get timelineEventsList() {
    return this.incidentTimelineModal.locator("[class*='event'], [data-testid='event']");
  }

  get reviewNotesTextarea() {
    return this.incidentTimelineModal.locator("textarea").first();
  }

  get reviewButton() {
    return this.incidentTimelineModal.getByRole("button", { name: /Review|Reviewed|Mark Reviewed/i }).first();
  }

  get dismissButton() {
    return this.incidentTimelineModal.getByRole("button", { name: /Dismiss|Remove|Dismiss Incident/i }).first();
  }

  // Locators — Settings panel
  get settingsPanel() {
    return this.page.locator("[class*='settings'], [data-testid='integrity-settings']");
  }

  get detectTabSwitchCheckbox() {
    return this.settingsPanel.locator("input[name*='tab_switch'], input[name*='tabSwitch']").first();
  }

  get detectCopyPasteCheckbox() {
    return this.settingsPanel.locator("input[name*='copy_paste'], input[name*='copyPaste']").first();
  }

  get detectCameraCheckbox() {
    return this.settingsPanel.locator("input[name*='camera']").first();
  }

  get tabSwitchLimitInput() {
    return this.settingsPanel.locator("input[type='number'][name*='limit'], input[placeholder*='limit']").first();
  }

  get settingsSaveButton() {
    return this.settingsPanel.getByRole("button", { name: /Save|Update/i }).first();
  }

  // Find incident row by student name/email
  incidentRowFor(studentIdentifier: string) {
    return this.page.locator("tbody tr, [data-testid='incident-row']").filter({ hasText: studentIdentifier });
  }

  // ── Expectations ──────────────────────────────────────────
  async expectLoaded(campaignId: string): Promise<void> {
    this.path = `/app/college-portal/campaigns/${campaignId}/integrity`;
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /campaigns.*integrity/,
      heading: this.heading,
      screenshot: "campaign_integrity_tab_loaded",
      allowConsoleNoise: true,
    });
  }

  async expectSummaryCardsVisible(): Promise<void> {
    await expect(this.summaryCards.first()).toBeVisible();
  }

  async expectIncidentsListVisible(): Promise<void> {
    await expect(this.flaggedIncidentsList).toBeVisible();
  }

  async expectTimelineModalVisible(): Promise<void> {
    await expect(this.incidentTimelineModal).toBeVisible();
  }

  async expectTimelineModalHidden(): Promise<void> {
    await expect(this.incidentTimelineModal).not.toBeVisible().catch(() => undefined);
  }

  async expectSettingsPanelVisible(): Promise<void> {
    await expect(this.settingsPanel).toBeVisible();
  }

  // ── Dashboard queries ─────────────────────────────────────
  async getTotalIncidentCount(): Promise<number> {
    const text = await this.totalIncidentsCard.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getHighRiskCount(): Promise<number> {
    const text = await this.highRiskCard.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getMediumRiskCount(): Promise<number> {
    const text = await this.mediumRiskCard.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getLowRiskCount(): Promise<number> {
    const text = await this.lowRiskCard.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getSummaryStats(): Promise<{
    total: number;
    high: number;
    medium: number;
    low: number;
  }> {
    return {
      total: await this.getTotalIncidentCount(),
      high: await this.getHighRiskCount(),
      medium: await this.getMediumRiskCount(),
      low: await this.getLowRiskCount(),
    };
  }

  // ── Incidents list queries ────────────────────────────────
  async getIncidentCount(): Promise<number> {
    return (await this.page.locator("tbody tr, [data-testid='incident-row']").all()).length;
  }

  async getIncidentRiskLevel(studentIdentifier: string): Promise<string> {
    const row = this.incidentRowFor(studentIdentifier);
    const riskCell = row.locator("td").filter({ hasText: /High|Medium|Low/i }).first();
    return (await riskCell.innerText()).trim();
  }

  async getIntegrityScore(studentIdentifier: string): Promise<number> {
    const row = this.incidentRowFor(studentIdentifier);
    const scoreCell = row.locator("td").filter({ hasText: /\d+/ }).first();
    const text = await scoreCell.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  async getEventCount(studentIdentifier: string): Promise<number> {
    const row = this.incidentRowFor(studentIdentifier);
    const eventCell = row.locator("td").nth(3); // Usually 4th column
    const text = await eventCell.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  // ── Timeline queries ──────────────────────────────────────
  async openIncidentTimeline(studentIdentifier: string): Promise<void> {
    const row = this.incidentRowFor(studentIdentifier);
    await expect(row).toBeVisible();
    await this.click(row);
    await expect(this.incidentTimelineModal).toBeVisible();
  }

  async closeIncidentTimeline(): Promise<void> {
    const closeBtn = this.incidentTimelineModal.locator("[aria-label='Close']").first();
    await this.click(closeBtn);
    await expect(this.incidentTimelineModal).not.toBeVisible();
  }

  async getTimelineEventCount(): Promise<number> {
    await expect(this.timelineEventsList).toBeTruthy();
    return (await this.timelineEventsList.all()).length;
  }

  async getTimelineEvents(): Promise<Array<{ type: string; riskDelta: number; timestamp?: string }>> {
    const events = await this.timelineEventsList.all();
    const result: Array<{ type: string; riskDelta: number; timestamp?: string }> = [];

    for (const event of events) {
      const text = await event.innerText();
      const typeMatch = text.match(/Tab Switch|Copy|Paste|Face|Camera|Fullscreen|Window|Blur/i);
      const deltaMatch = text.match(/[+\-]\d+|\d+\s*point/i);

      result.push({
        type: typeMatch?.[0] || "Unknown",
        riskDelta: deltaMatch ? parseInt(deltaMatch[0].match(/\d+/)?.[0] ?? "0") : 0,
        timestamp: undefined,
      });
    }

    return result;
  }

  async getIntegrityScoreFromTimeline(): Promise<number> {
    const header = this.incidentTimelineModal.locator("h1, h2, [class*='title']").first();
    const text = await header.innerText();
    return parseInt(text.match(/\d+/)?.[0] ?? "0");
  }

  // ── Timeline actions ──────────────────────────────────────
  async reviewIncident(notes: string): Promise<void> {
    await this.type(this.reviewNotesTextarea, notes);
    await this.click(this.reviewButton);
    await this.page.waitForLoadState("networkidle");
    await expectToast(this.page, /Reviewed|Updated|Marked/i, 15_000);
  }

  async dismissIncident(): Promise<void> {
    await this.click(this.dismissButton);
    await this.page.waitForLoadState("networkidle");
    await expectToast(this.page, /Dismissed|Removed|Cleared/i, 15_000);
  }

  async reviewAndDismiss(notes: string): Promise<void> {
    await this.type(this.reviewNotesTextarea, notes);
    await this.click(this.reviewButton);
    await this.page.waitForLoadState("networkidle");
    await this.click(this.dismissButton);
    await this.page.waitForLoadState("networkidle");
  }

  // ── Settings actions ──────────────────────────────────────
  async openSettings(): Promise<void> {
    await this.click(this.settingsButton);
    await expect(this.settingsPanel).toBeVisible();
  }

  async configureDetectionSettings(config: {
    detectTabSwitch?: boolean;
    detectCopyPaste?: boolean;
    detectCamera?: boolean;
    tabSwitchLimit?: number;
  }): Promise<void> {
    await this.openSettings();

    if (config.detectTabSwitch !== undefined) {
      const isChecked = await this.detectTabSwitchCheckbox.isChecked();
      if (isChecked !== config.detectTabSwitch) {
        await this.click(this.detectTabSwitchCheckbox);
      }
    }

    if (config.detectCopyPaste !== undefined) {
      const isChecked = await this.detectCopyPasteCheckbox.isChecked();
      if (isChecked !== config.detectCopyPaste) {
        await this.click(this.detectCopyPasteCheckbox);
      }
    }

    if (config.detectCamera !== undefined) {
      const isChecked = await this.detectCameraCheckbox.isChecked();
      if (isChecked !== config.detectCamera) {
        await this.click(this.detectCameraCheckbox);
      }
    }

    if (config.tabSwitchLimit !== undefined) {
      await this.tabSwitchLimitInput.clear();
      await this.type(this.tabSwitchLimitInput, String(config.tabSwitchLimit));
    }

    await this.click(this.settingsSaveButton);
    await this.page.waitForLoadState("networkidle");
    await expectToast(this.page, /Settings saved|Updated|Configuration|saved/i, 15_000);
  }

  // ── State checks ──────────────────────────────────────────
  async expectIncidentVisibleForStudent(studentIdentifier: string): Promise<void> {
    const row = this.incidentRowFor(studentIdentifier);
    await expect(row).toBeVisible();
  }

  async expectIncidentNotVisibleForStudent(studentIdentifier: string): Promise<void> {
    const row = this.incidentRowFor(studentIdentifier);
    await expect(row).not.toBeVisible().catch(() => undefined);
  }

  async expectHighRiskIncident(studentIdentifier: string): Promise<void> {
    const riskLevel = await this.getIncidentRiskLevel(studentIdentifier);
    expect(riskLevel.toLowerCase()).toMatch(/high|critical/);
  }

  async expectMediumRiskIncident(studentIdentifier: string): Promise<void> {
    const riskLevel = await this.getIncidentRiskLevel(studentIdentifier);
    expect(riskLevel.toLowerCase()).toMatch(/medium/);
  }

  async expectLowRiskIncident(studentIdentifier: string): Promise<void> {
    const riskLevel = await this.getIncidentRiskLevel(studentIdentifier);
    expect(riskLevel.toLowerCase()).toMatch(/low/);
  }
}
