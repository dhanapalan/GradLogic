import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES, STRONG_PASSWORD, WEAK_PASSWORD } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class PasswordSetupPage extends BasePage {
  readonly path = ROUTES.setupPassword;
  readonly heading = /Secure Your Account/i;

  get newPassword() {
    return this.page.locator("#new-password");
  }
  get confirmPassword() {
    return this.page.locator("#confirm-password");
  }
  get submit() {
    return this.page.getByRole("button", { name: /Set Password & Continue/i });
  }

  async expectForcedReset(): Promise<void> {
    await this.waitLoaded();
    await expect(this.page).toHaveURL(/\/auth\/setup-password/);
    await this.validate({
      urlIncludes: /setup-password/,
      heading: this.heading,
      requiredControls: [this.newPassword, this.confirmPassword, this.submit],
      screenshot: "forced_password_reset",
      allowConsoleNoise: true,
    });
  }

  /** Attempt a weak password — expect client or server rejection. */
  async assertPasswordPolicyRejectsWeak(): Promise<void> {
    await this.type(this.newPassword, WEAK_PASSWORD);
    await this.type(this.confirmPassword, WEAK_PASSWORD);
    await this.click(this.submit);
    await expectToast(this.page, /at least|Password|invalid|failed/i);
    await expect(this.page).toHaveURL(/setup-password/);
    await this.shot("password_policy_rejected");
  }

  async setStrongPassword(password = STRONG_PASSWORD): Promise<void> {
    await this.type(this.newPassword, password);
    await this.type(this.confirmPassword, password);
    await this.click(this.submit);
    await this.page
      .waitForResponse(
        (r) =>
          r.url().includes("/auth/setup-password") &&
          r.request().method() === "POST" &&
          r.ok(),
        { timeout: 30_000 }
      )
      .catch(() => undefined);
    await expectToast(this.page, /Password updated|success/i);
    await this.shot("password_setup_success");
  }
}
