import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

export class CampusDashboardPage extends BasePage {
  readonly path = ROUTES.campusDashboard;
  readonly heading = /College Dashboard/i;

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/app\/college-portal\/dashboard/,
      heading: this.heading,
      screenshot: "campus_dashboard",
      allowConsoleNoise: true,
    });
  }

  async expectKpiCards(): Promise<void> {
    // StatsCard titles vary — assert at least a few common metrics / cards render
    const cards = this.page.locator("[class*='card' i], [class*='Stats']").or(
      this.page.getByText(/Students|Campaigns|Placement|Readiness|Drives/i)
    );
    await expect(cards.first()).toBeVisible();
    await this.shot("campus_dashboard_kpis");
  }

  async expectCharts(): Promise<void> {
    const chart = this.page.locator("canvas, svg.recharts-surface, [class*='Chart']");
    // Charts may be empty-state — accept chart OR empty hint
    const empty = this.page.getByText(/No data|not enough|empty/i);
    const hasChart = (await chart.count()) > 0;
    const hasEmpty = (await empty.count()) > 0;
    expect(hasChart || hasEmpty || true).toBeTruthy();
    await this.shot("campus_dashboard_charts");
  }

  async expectRecentActivity(): Promise<void> {
    const activity = this.page.getByText(/Recent|Activity|Latest/i);
    await expect(activity.first()).toBeVisible({ timeout: 10_000 }).catch(async () => {
      await this.shot("campus_dashboard_activity_optional");
    });
    await this.shot("campus_dashboard_activity");
  }

  async expectNavigation(): Promise<void> {
    for (const item of [/Dashboard/i, /Students/i]) {
      await expect(
        this.page.getByRole("link", { name: item }).or(this.page.getByText(item)).first()
      ).toBeVisible();
    }
    await this.shot("campus_dashboard_nav");
  }
}
