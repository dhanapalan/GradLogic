import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class CampusAdminsPage extends BasePage {
  readonly path = ROUTES.campusAdmins;
  readonly heading = /Campus Admins/i;

  get addStaffMember() {
    return this.page.getByRole("button", { name: /Add Staff Member/i });
  }
  get nameInput() {
    return this.page.getByPlaceholder("e.g. Dr. Priya Sharma");
  }
  get emailInput() {
    return this.page.getByPlaceholder("staff@campus.edu");
  }
  get passwordInput() {
    return this.page.getByPlaceholder("Min. 6 characters");
  }
  get addMember() {
    return this.page.getByRole("button", { name: /^Add Member$/i });
  }
  get closeModal() {
    return this.page.getByRole("button", { name: /^Cancel$/i });
  }

  rowFor(name: string) {
    return this.page.locator("tbody tr").filter({ hasText: name });
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/college\/campus-admins/,
      heading: this.heading,
      requiredControls: [this.addStaffMember],
      screenshot: "campus_admins_loaded",
      allowConsoleNoise: true,
    });
  }

  async addStaff(name: string, email: string, password: string): Promise<void> {
    await this.click(this.addStaffMember);
    await this.type(this.nameInput, name);
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.click(this.addMember);
    await expectToast(this.page, /Staff member added successfully/i);
  }

  /**
   * CampusAdminsPage still uses a native window.confirm() for removal.
   * "Remove" is a soft-delete (DELETE /colleges/staff/:id sets is_active=false) —
   * the row stays in the Staff Directory table but its Status badge flips to
   * "Inactive", it does not disappear.
   */
  async removeStaff(name: string): Promise<void> {
    this.page.once("dialog", (d) => d.accept());
    const row = this.rowFor(name);
    await this.click(row.getByRole("button", { name: /Remove/i }));
    await expectToast(this.page, /Staff member removed/i);
  }

  async statusFor(name: string): Promise<string> {
    const row = this.rowFor(name);
    await expect(row).toBeVisible();
    return (await row.locator("td").nth(3).innerText()).trim();
  }
}
