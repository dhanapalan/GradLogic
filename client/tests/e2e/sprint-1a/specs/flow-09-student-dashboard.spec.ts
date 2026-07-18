/**
 * FLOW 9 — Student Dashboard
 * Dashboard → Progress → Assessments → Recommendations → Notifications
 */
import { test, expect } from "../fixtures/test.fixture";
import { STRONG_PASSWORD, ROUTES } from "../config/env";
import { readState } from "../helpers/runtime-state";

test.describe("FLOW 9 — Student Dashboard", () => {
  test("9.1 Verify student dashboard widgets", async ({
    loginPage,
    passwordSetupPage,
    studentDashboard,
    page,
  }) => {
    const state = readState();
    test.skip(!state.studentEmail, "Requires Flow 6/7/8 student credentials");

    const password = state.studentPassword || STRONG_PASSWORD;
    await loginPage.loginAs(state.studentEmail!, password, "Student");

    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }

    if (page.url().includes("student-onboarding")) {
      test.info().annotations.push({
        type: "note",
        description: "Profile still incomplete — open portal after onboarding",
      });
      await page.goto(ROUTES.studentDashboard);
    }

    await expect(page).toHaveURL(/student-portal/, { timeout: 45_000 });
    await studentDashboard.expectLoaded();
    await studentDashboard.expectProgress();
    await studentDashboard.expectAssessments();
    await studentDashboard.expectRecommendations();
    await studentDashboard.expectNotifications();
  });
});
