import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class ApprovalsPage extends BasePage {
  readonly path = ROUTES.approvals;
  readonly heading = /Approvals/i;

  get collegesTab() {
    return this.page.getByRole("button", { name: /Pending College Registrations/i });
  }
  get questionsTab() {
    return this.page.getByRole("button", { name: /Pending AI Questions/i });
  }

  cardFor(collegeName: string) {
    return this.page
      .locator("div.bg-white.rounded-xl.border")
      .filter({ hasText: collegeName });
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/app\/superadmin\/approvals/,
      heading: this.heading,
      requiredControls: [this.collegesTab],
      screenshot: "approvals_loaded",
      allowConsoleNoise: true,
    });
  }

  async approveCollege(collegeName: string, note?: string): Promise<void> {
    const card = this.cardFor(collegeName);
    await expect(card).toBeVisible();
    await this.click(card.getByRole("button", { name: /^Approve$/i }));
    if (note) await this.type(card.locator("textarea"), note);
    await this.click(card.getByRole("button", { name: /Confirm Approval/i }));
    await expectToast(this.page, /approved/i);
  }

  async rejectCollege(collegeName: string, reason: string): Promise<void> {
    const card = this.cardFor(collegeName);
    await expect(card).toBeVisible();
    await this.click(card.getByRole("button", { name: /^Reject$/i }));
    if (reason) await this.type(card.locator("textarea"), reason);
    await this.click(card.getByRole("button", { name: /Confirm Rejection/i }));
  }

  async expectCollegeGone(collegeName: string): Promise<void> {
    await expect(this.cardFor(collegeName)).toHaveCount(0);
  }
}
