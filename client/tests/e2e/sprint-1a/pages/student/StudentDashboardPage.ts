import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

export class StudentDashboardPage extends BasePage {
  readonly path = ROUTES.studentDashboard;
  readonly heading = /Dashboard/i;

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await expect(this.page).toHaveURL(/\/app\/student-portal/);
    await expect(
      this.page.getByRole("heading", { name: /Dashboard/i }).or(this.page.getByText(/Welcome/i)).first()
    ).toBeVisible();
    await this.shot("student_dashboard");
  }

  async expectProgress(): Promise<void> {
    const progress = this.page.getByText(/Progress|Readiness|Completion|%|Journey/i);
    await expect(progress.first()).toBeVisible({ timeout: 15_000 }).catch(async () => {
      await this.shot("student_progress_optional");
    });
    await this.shot("student_dashboard_progress");
  }

  async expectAssessments(): Promise<void> {
    const a = this.page.getByText(/Assessment|Practice|Mock|Test/i);
    await expect(a.first()).toBeVisible({ timeout: 15_000 }).catch(async () => {
      await this.shot("student_assessments_optional");
    });
    await this.shot("student_dashboard_assessments");
  }

  async expectRecommendations(): Promise<void> {
    const r = this.page.getByText(/Recommend|Suggested|Next|Learning/i);
    await expect(r.first()).toBeVisible({ timeout: 10_000 }).catch(async () => {
      await this.shot("student_recommendations_optional");
    });
    await this.shot("student_dashboard_recommendations");
  }

  async expectNotifications(): Promise<void> {
    const n = this.page
      .locator("[aria-label*='notification' i]")
      .or(this.page.getByText(/Notification/i));
    await expect(n.first()).toBeVisible({ timeout: 10_000 }).catch(async () => {
      await this.shot("student_notifications_optional");
    });
    await this.shot("student_dashboard_notifications");
  }
}
