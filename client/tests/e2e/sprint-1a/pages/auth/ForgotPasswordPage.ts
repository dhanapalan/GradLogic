import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

export class ForgotPasswordPage extends BasePage {
  readonly path = ROUTES.forgotPassword;
  readonly heading = /Forgot password/i;

  get email() {
    return this.page.locator("#email");
  }
  get sendCode() {
    return this.page.getByRole("button", { name: /Send verification code/i });
  }
  get otp() {
    return this.page.locator("#otp");
  }
  get verifyCode() {
    return this.page.getByRole("button", { name: /Verify code/i });
  }
  get resend() {
    return this.page.getByRole("button", { name: /Resend code/i });
  }
  get devOtpBanner() {
    return this.page.getByText(/Dev mode — OTP:/i);
  }
  get otpError() {
    return this.page.getByRole("alert");
  }

  async open(): Promise<void> {
    await this.page.goto(this.path, { waitUntil: "domcontentloaded" });
    await this.waitLoaded();
  }

  async requestReset(email: string): Promise<void> {
    await this.open();
    await this.type(this.email, email);
    await this.click(this.sendCode);
    await expect(this.otp).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Reads the dev-mode OTP banner rendered by ForgotPasswordPage.tsx when the
   * server isn't in production — the realistic way for a test to obtain the
   * code without a real inbox. Returns null if the server is production-like
   * (banner never renders), in which case the test needs a different path.
   */
  async getDevOtp(): Promise<string | null> {
    if (!(await this.devOtpBanner.count())) return null;
    const text = await this.devOtpBanner.innerText();
    const match = text.match(/(\d{6})/);
    return match ? match[1] : null;
  }

  async submitOtp(code: string): Promise<void> {
    await this.type(this.otp, code);
    await this.click(this.verifyCode);
  }
}
