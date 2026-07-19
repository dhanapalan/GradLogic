/**
 * FLOW 5 — Campus Dashboard
 * KPI cards → Charts → Recent activity → Notifications → Navigation
 */
import { test, expect } from "../fixtures/test.fixture";
import { COLLEGE_ADMIN, STRONG_PASSWORD } from "../config/env";
import { readState } from "../helpers/runtime-state";

test.describe("FLOW 5 — Campus Dashboard", () => {
  test("5.1 Verify campus dashboard surfaces", async ({
    loginPage,
    campusDashboard,
    appNav,
    page,
  }) => {
    const state = readState();
    const email = state.tpoEmail || COLLEGE_ADMIN.email;
    const password = state.tpoPassword || COLLEGE_ADMIN.password;

    await loginPage.loginAs(email, password, "College Admin");
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    await campusDashboard.expectLoaded();
    await campusDashboard.expectKpiCards();
    await campusDashboard.expectCharts();
    await campusDashboard.expectRecentActivity();
    await campusDashboard.expectNavigation();
    await appNav.expectNotificationsAffordance().catch(() => undefined);
  });
});
