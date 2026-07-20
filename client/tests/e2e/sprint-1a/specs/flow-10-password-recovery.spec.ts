/**
 * FLOW 10 — Password Recovery (forgot → OTP → reset → login)
 * Uses the dev-mode OTP banner (ForgotPasswordPage.tsx) since the server
 * only echoes the OTP outside production — this suite runs against a
 * dev/staging stack, matching every other flow-0N spec's assumptions.
 *
 * Runs against a disposable college_admin account created fresh for this
 * spec (not SUPER_ADMIN) — mutating a shared account's real password here
 * would break every other spec that logs in as it if a step failed midway.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, STRONG_PASSWORD, ROUTES } from "../config/env";
import { buildCollege } from "../data/factories";
import { writeState, readState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 10 — Password Recovery", () => {
  test("10.0 Setup: create a disposable college_admin account", async ({
    loginPage,
    collegeCreate,
    approvalsPage,
    passwordSetupPage,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const college = buildCollege();
    await page.goto(ROUTES.collegesNew);
    const creds = await collegeCreate.create(college);
    await collegeCreate.done();

    await page.goto(ROUTES.approvals);
    await approvalsPage.expectLoaded();
    await approvalsPage.approveCollege(college.name);

    await loginPage.loginAs(creds.tpoEmail, creds.temporaryPassword, "College Admin");
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }
    if (page.url().includes("/auth/login")) {
      await loginPage.loginAs(creds.tpoEmail, STRONG_PASSWORD, "College Admin");
    }
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    writeState({ passwordRecoveryEmail: creds.tpoEmail });
  });

  test("10.1 Request reset, verify OTP, set new password, login with it", async ({
    forgotPasswordPage,
    resetPasswordPage,
    loginPage,
    page,
  }) => {
    const state = readState();
    test.skip(!state.passwordRecoveryEmail, "Requires 10.0 setup state");

    await forgotPasswordPage.requestReset(state.passwordRecoveryEmail!);
    const otp = await forgotPasswordPage.getDevOtp();
    test.skip(!otp, "Dev-mode OTP banner not rendered — server is not in a dev/staging mode");

    await forgotPasswordPage.submitOtp(otp!);
    await expect(page).toHaveURL(/\/auth\/reset-password/);
    await resetPasswordPage.expectReady();

    const newPassword = "Recovered@2026!";
    await resetPasswordPage.reset(newPassword);
    await expect(page).toHaveURL(/\/auth\/login/);

    await loginPage.loginAs(state.passwordRecoveryEmail!, newPassword, "College Admin");
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });
  });

  test("10.2 Wrong OTP → error, stays on OTP step", async ({ forgotPasswordPage, page }) => {
    const state = readState();
    test.skip(!state.passwordRecoveryEmail, "Requires 10.0 setup state");

    await forgotPasswordPage.requestReset(state.passwordRecoveryEmail!);
    const otp = await forgotPasswordPage.getDevOtp();
    test.skip(!otp, "Dev-mode OTP banner not rendered — server is not in a dev/staging mode");

    const wrong = otp === "000000" ? "111111" : "000000";
    await forgotPasswordPage.submitOtp(wrong);
    await expect(page.locator("[role='status'], [class*='toast']")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    await expect(forgotPasswordPage.otp).toBeVisible();
  });

  test("10.3 Reset-password page with no token → invalid-link state", async ({
    resetPasswordPage,
    page,
  }) => {
    await page.goto(ROUTES.resetPassword, { waitUntil: "domcontentloaded" });
    await resetPasswordPage.expectInvalidLink();
  });
});
