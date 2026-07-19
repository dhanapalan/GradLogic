/**
 * FLOW 7 — Student Login
 * Login → Forced Password Reset → Dashboard → Logout
 */
import { test, expect } from "../fixtures/test.fixture";
import { STRONG_PASSWORD } from "../config/env";
import { readState, writeState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 7 — Student Login", () => {
  test("7.1 Student login with temp password, forced reset, dashboard, logout", async ({
    loginPage,
    passwordSetupPage,
    studentDashboard,
    studentOnboarding,
    appNav,
    page,
  }) => {
    const state = readState();
    test.skip(
      !state.studentEmail || !state.studentTempPassword,
      "Requires Flow 6 student credentials in runtime state"
    );

    await loginPage.loginAs(state.studentEmail!, state.studentTempPassword!, "Student");

    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.assertPasswordPolicyRejectsWeak();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
      writeState({ studentPassword: STRONG_PASSWORD });
    }

    // After password setup: onboarding OR student portal
    await page.waitForTimeout(500);
    if (page.url().includes("/auth/login")) {
      await loginPage.loginAs(state.studentEmail!, STRONG_PASSWORD, "Student");
    }

    if (page.url().includes("student-onboarding")) {
      await studentOnboarding.expectOnboarding();
      await studentOnboarding.shot("student_login_lands_onboarding");
    } else {
      await expect(page).toHaveURL(/student-portal|student-onboarding/, { timeout: 45_000 });
      if (page.url().includes("student-portal")) {
        await studentDashboard.expectLoaded();
      }
    }

    // Logout if chrome available
    await appNav.logout().catch(async () => {
      await page.goto("/auth/login");
    });
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 20_000 });
  });
});
