import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class PaymentsPage extends BasePage {
  readonly path = ROUTES.payments;
  readonly heading = /Payments/i;

  get payNow() {
    return this.page.getByRole("button", { name: /Pay Now/i });
  }
  get historyTable() {
    return this.page.locator("table");
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/student-portal\/payments/,
      heading: this.heading,
      screenshot: "payments_loaded",
      allowConsoleNoise: true,
    });
  }

  async payCurrentFee(): Promise<void> {
    await this.click(this.payNow);
    await expectToast(this.page, /Payment successful/i, 20_000);
  }

  async currentStatusBadge(): Promise<string> {
    const badge = this.page
      .locator("span")
      .filter({ hasText: /Paid|Pending|Overdue|Waived/i })
      .first();
    return (await badge.innerText()).trim();
  }
}
