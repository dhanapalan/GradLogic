import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

export class SuperAdminDashboardPage extends BasePage {
  readonly path = ROUTES.superadminDashboard;
  readonly heading = /Admin Dashboard/i;

  kpi(title: string) {
    return this.page.getByText(title, { exact: true }).first();
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/app\/superadmin\/dashboard/,
      heading: this.heading,
      screenshot: "superadmin_dashboard",
      allowConsoleNoise: true,
    });
  }

  async expectKpis(): Promise<void> {
    for (const title of [
      "Total Colleges",
      "Active Students",
      "Pending Actions",
      "Active Users",
    ]) {
      await expect(this.kpi(title)).toBeVisible();
    }
    await this.shot("superadmin_dashboard_kpis");
  }

  async expectNavigationMenu(): Promise<void> {
    for (const item of ["Dashboard", "Colleges", "Students", "Users"]) {
      const loc = this.page
        .getByRole("link", { name: new RegExp(item, "i") })
        .or(this.page.getByRole("button", { name: new RegExp(item, "i") }));
      await expect(loc.first()).toBeVisible();
    }
    await this.shot("superadmin_nav_menu");
  }
}
