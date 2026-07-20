import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class BillingPage extends BasePage {
  readonly path = ROUTES.billing;
  readonly heading = /Student Fee Billing/i;

  get generateFeeRecords() {
    return this.page.getByRole("button", { name: /Generate Fee Records/i });
  }
  get search() {
    return this.page.getByPlaceholder("Search name or email...");
  }

  rowFor(studentName: string) {
    return this.page.locator("tbody tr").filter({ hasText: studentName });
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/college\/billing/,
      heading: this.heading,
      requiredControls: [this.generateFeeRecords],
      screenshot: "billing_loaded",
      allowConsoleNoise: true,
    });
  }

  async generateRecords(): Promise<void> {
    await this.click(this.generateFeeRecords);
    await expectToast(this.page, /generated|Fee records/i);
  }

  async searchStudent(name: string): Promise<void> {
    await this.type(this.search, name);
    await this.page.waitForTimeout(400);
  }

  async markPaid(
    studentName: string,
    method: "Cash" | "UPI" | "Card" | "Bank Transfer" = "Cash"
  ): Promise<void> {
    const row = this.rowFor(studentName);
    await expect(row).toBeVisible();
    await this.click(row.getByRole("button", { name: /Mark Paid/i }));
    await this.click(this.page.getByRole("button", { name: new RegExp(`^${method}$`, "i") }));
    await this.click(this.page.getByRole("button", { name: /Confirm Payment/i }));
    await expectToast(this.page, /Payment recorded/i);
  }

  async statusFor(studentName: string): Promise<string> {
    const row = this.rowFor(studentName);
    await expect(row).toBeVisible();
    return (await row.locator("td").nth(3).innerText()).trim();
  }
}
