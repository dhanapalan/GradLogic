import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

export class ResetPasswordPage extends BasePage {
  readonly path = ROUTES.resetPassword;
  readonly heading = /Set a new password/i;

  get password() {
    return this.page.getByPlaceholder("Enter a new password");
  }
  get confirm() {
    return this.page.getByPlaceholder("Re-enter your new password");
  }
  get submit() {
    return this.page.getByRole("button", { name: /Reset password/i });
  }

  async expectReady(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: this.heading })).toBeVisible();
  }

  async expectInvalidLink(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /Invalid reset link/i })).toBeVisible();
  }

  async reset(newPassword: string): Promise<void> {
    await this.type(this.password, newPassword);
    await this.type(this.confirm, newPassword);
    await this.click(this.submit);
  }
}
