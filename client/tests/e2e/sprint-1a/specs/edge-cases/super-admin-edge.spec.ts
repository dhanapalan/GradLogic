/**
 * SUPER ADMIN — portal edge cases (authz / UI state)
 * Reuses existing Sprint 1A POMs only.
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN, COLLEGE_ADMIN, ROUTES } from "../../config/env";
import { clearSession, expectStillOnUrl } from "../../helpers/edge-expect";

test.describe("EDGE — Super Admin portal", () => {
  test("Unauthorized deep link without session → login", async ({ page, loginPage }) => {
    await clearSession(page);
    await page.goto(ROUTES.collegesNew);
    await expectStillOnUrl(page, /\/auth\/login/);
    await loginPage.expectStillOnLogin();
    await loginPage.shot("superadmin_unauthorized_deep_link");
  });

  test("College Admin session cannot open Super Admin colleges create", async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password, "College Admin");
    await expect(page).toHaveURL(/\/app\/college-portal|\/auth\/setup-password/, {
      timeout: 45_000,
    });
    if (page.url().includes("setup-password")) {
      test.skip(true, "College admin forced password reset — run after reset");
    }
    await page.goto(ROUTES.collegesNew);
    // Expect block: not-authorized, redirect, or empty shell — not the create form
    await page.waitForTimeout(1000);
    const onCreate = await page.getByRole("heading", { name: /Add New College/i }).count();
    expect(onCreate).toBe(0);
    await loginPage.shot("superadmin_blocked_for_college_admin");
  });

  test("Super Admin dashboard survives soft navigation + console clean", async ({
    loginPage,
    superAdminDashboard,
    consoleMon,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await superAdminDashboard.expectLoaded();
    await page.goto(ROUTES.colleges);
    await page.goto(ROUTES.superadminDashboard);
    await superAdminDashboard.expectLoaded();
    consoleMon.assertClean("superadmin_nav_roundtrip");
  });
});
