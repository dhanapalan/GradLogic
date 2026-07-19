/**
 * FLOW 4 — College Admin Login
 * Login (temp password) → Forced Password Reset → Policy → Login again → Dashboard → Logout
 */
import { test, expect } from "../fixtures/test.fixture";
import { COLLEGE_ADMIN, STRONG_PASSWORD } from "../config/env";
import { readState, writeState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 4 — College Admin Login", () => {
  test("4.1 Login with college admin credentials (generated or seeded)", async ({
    loginPage,
    passwordSetupPage,
    campusDashboard,
    page,
  }) => {
    const state = readState();
    const email = state.tpoEmail || COLLEGE_ADMIN.email;
    const password = state.tpoTempPassword || COLLEGE_ADMIN.password;

    await loginPage.loginAs(email, password, "College Admin");

    // New college admins are forced through password setup
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.assertPasswordPolicyRejectsWeak();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
      writeState({ tpoPassword: STRONG_PASSWORD, tpoEmail: email });
    }

    // May land on dashboard after setup, or need re-login
    if (page.url().includes("/auth/login") || page.url().includes("/auth/setup-password") === false) {
      if (!page.url().includes("/college-portal")) {
        await loginPage.loginAs(email, state.tpoPassword || STRONG_PASSWORD || password, "College Admin");
      }
    }

    await expect(page).toHaveURL(/\/app\/college-portal\/dashboard|\/auth\/setup-password/, {
      timeout: 45_000,
    });

    if (page.url().includes("/college-portal")) {
      await campusDashboard.expectLoaded();
    }
  });

  test("4.2 Re-login with new password and verify dashboard then logout", async ({
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
    await appNav.logout();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
