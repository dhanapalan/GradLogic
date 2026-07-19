import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { expectToast } from "../../utils/assertions";

export class CollegeDetailPage extends BasePage {
  readonly path = "/app/superadmin/colleges/";
  readonly heading = /.+/;

  get editToggle() {
    return this.page.getByRole("button", { name: /^Edit$/i }).or(this.page.getByText(/^Edit$/i));
  }
  get save() {
    return this.page.getByRole("button", { name: /^Save$/i });
  }

  async expectDetails(collegeName: string): Promise<void> {
    await this.waitLoaded();
    await expect(this.page).toHaveURL(/\/app\/superadmin\/colleges\/.+/);
    await expect(this.page.getByText(collegeName).first()).toBeVisible();
    await this.shot("college_details");
  }

  async editCity(newCity: string): Promise<void> {
    // Detail page may already be in view mode — open edit if needed
    const cityInput = this.page.getByPlaceholder("City").or(this.page.locator('[name="city"]'));
    if (!(await cityInput.isVisible().catch(() => false))) {
      const editLink = this.page.locator("a[href*='edit=1']").or(this.page.getByRole("button", { name: /Edit/i }));
      if (await editLink.count()) await this.click(editLink.first());
      // fallback: navigate with ?edit=1
      if (!(await cityInput.isVisible().catch(() => false))) {
        await this.page.goto(this.page.url().split("?")[0] + "?edit=1");
        await this.waitLoaded();
      }
    }
    await this.type(cityInput.first(), newCity);
    await this.click(this.save.first());
    await expectToast(this.page, /updated|saved|success/i);
    await this.shot("college_edited");
  }
}
