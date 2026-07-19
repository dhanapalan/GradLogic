import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { ConfirmModal } from "../../components/ConfirmModal";
import { expectToast } from "../../utils/assertions";

export class CollegesListPage extends BasePage {
  readonly path = ROUTES.colleges;
  readonly heading = /All Colleges/i;

  get search() {
    return this.page.getByPlaceholder("Search colleges...");
  }
  get addCollege() {
    return this.page.getByRole("link", { name: /Add College/i });
  }
  get table() {
    return this.page.locator("table");
  }

  rowFor(name: string) {
    return this.page.locator("tbody tr").filter({ hasText: name });
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/app\/superadmin\/colleges/,
      heading: this.heading,
      requiredControls: [this.search, this.addCollege, this.table],
      screenshot: "colleges_list",
      allowConsoleNoise: true,
    });
  }

  async searchCollege(name: string): Promise<void> {
    await this.type(this.search, name);
    await this.page.waitForTimeout(500); // debounce in AllCollegesPage
    await this.shot(`colleges_search_${name.slice(0, 20)}`);
  }

  async openCreate(): Promise<void> {
    await this.click(this.addCollege);
    await expect(this.page).toHaveURL(/\/colleges\/new/);
  }

  async openView(name: string): Promise<void> {
    const row = this.rowFor(name);
    await expect(row).toBeVisible();
    await this.click(row.getByRole("button", { name: /View college/i }).or(row.locator("[aria-label='View college']")));
  }

  async openEdit(name: string): Promise<void> {
    const row = this.rowFor(name);
    await this.click(row.getByRole("button", { name: /Edit college/i }).or(row.locator("[aria-label='Edit college']")));
  }

  async statusText(name: string): Promise<string> {
    const row = this.rowFor(name);
    await expect(row).toBeVisible();
    return (await row.locator("td").nth(4).innerText()).trim();
  }

  async clickSuspendOrActivate(name: string): Promise<void> {
    const row = this.rowFor(name);
    const suspend = row.locator("[aria-label='Suspend college']");
    const activate = row.locator("[aria-label='Activate college']");
    if (await suspend.count()) await this.click(suspend);
    else await this.click(activate);
  }

  async expectStatus(name: string, status: RegExp): Promise<void> {
    await expect(this.rowFor(name)).toContainText(status);
    await this.shot(`college_status_${status}`);
  }

  async suspendWithCancelThenConfirm(
    name: string,
    modal: ConfirmModal
  ): Promise<void> {
    const before = await this.statusText(name);

    // Cancel path
    await this.clickSuspendOrActivate(name);
    await modal.expectOpen(/Suspend college/i);
    await modal.cancel();
    expect(await this.statusText(name)).toBe(before);
    await this.shot("college_deactivate_cancelled");

    // Confirm path
    await this.clickSuspendOrActivate(name);
    await modal.expectOpen(/Suspend college/i);
    await modal.confirm(/Suspend/i);
    await expectToast(this.page, /suspended/i);
    await this.expectStatus(name, /suspended|inactive/i);
  }

  async activate(name: string, modal: ConfirmModal): Promise<void> {
    await this.clickSuspendOrActivate(name);
    await modal.expectOpen(/Activate college/i);
    await modal.confirm(/Activate/i);
    await expectToast(this.page, /activated/i);
    await this.expectStatus(name, /active/i);
  }
}
