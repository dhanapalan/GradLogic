/**
 * FLOW 1 — Super Admin Login
 * Login → Dashboard → KPIs → Navigation → Profile → Notifications → Logout
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN } from "../config/env";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 1 — Super Admin Login", () => {
  test("1.1 Login as Super Admin and land on Admin Dashboard", async ({
    loginPage,
    superAdminDashboard,
    networkMon,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(loginPage.page).toHaveURL(/\/app\/superadmin\/dashboard/, {
      timeout: 45_000,
    });
    networkMon.assertApiSuccess("/auth/login", "POST");
    await superAdminDashboard.expectLoaded();
  });

  test("1.2 Verify Dashboard KPIs", async ({ page, superAdminDashboard, loginPage }) => {
    if (!page.url().includes("/superadmin/dashboard")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
      await expect(page).toHaveURL(/dashboard/);
    }
    await superAdminDashboard.expectKpis();
  });

  test("1.3 Verify Navigation Menu", async ({ page, superAdminDashboard, appNav, loginPage }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    await superAdminDashboard.expectNavigationMenu();
    await expect(appNav.link(/Colleges|All Colleges/i).or(page.getByText(/Colleges/i)).first()).toBeVisible();
  });

  test("1.4 Verify User Profile affordance", async ({ page, appNav, loginPage }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    await appNav.expectProfileVisible(/Welcome back|Admin|GradLogic/i);
  });

  test("1.5 Verify Notifications affordance", async ({ page, appNav, loginPage }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    await appNav.expectNotificationsAffordance();
  });

  test("1.6 Logout returns to login", async ({ page, appNav, loginPage }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    await appNav.logout();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 20_000 });
    await loginPage.expectStillOnLogin();
    await loginPage.shot("superadmin_logged_out");
  });
});
