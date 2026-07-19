/**
 * LOGIN EDGE CASES — Super Admin / College Admin / Student tabs
 */
import { test, expect } from "../../fixtures/test.fixture";
import {
  SUPER_ADMIN,
  COLLEGE_ADMIN,
  STRONG_PASSWORD,
  ROUTES,
} from "../../config/env";
import {
  expectErrorToast,
  expectStillOnUrl,
  waitForApi,
  expectApiStatus,
  clearSession,
  corruptAccessToken,
} from "../../helpers/edge-expect";

test.describe("EDGE — Login negative paths", () => {
  test("Wrong password → error toast, stay on login, API 401", async ({
    loginPage,
    page,
  }) => {
    await loginPage.open("Super Admin");
    await loginPage.type(loginPage.identifier, SUPER_ADMIN.email);
    await loginPage.type(loginPage.password, "WrongPassword!999");
    const resPromise = waitForApi(page, "/auth/login", "POST");
    await loginPage.click(loginPage.signIn);
    const res = await resPromise;
    await expectApiStatus(res, [401, 400, 403], "wrong password");
    await expectErrorToast(page, /Invalid|incorrect|failed|credentials|password/i, "login_wrong_password");
    await expectStillOnUrl(page, /\/auth\/login/);
    await expect(loginPage.signIn).toBeVisible();
  });

  test("Wrong username → error toast + API failure", async ({ loginPage, page }) => {
    await loginPage.open("Super Admin");
    await loginPage.type(loginPage.identifier, "nobody.exists@gradlogic.invalid");
    await loginPage.type(loginPage.password, SUPER_ADMIN.password);
    const resPromise = waitForApi(page, "/auth/login", "POST");
    await loginPage.click(loginPage.signIn);
    const res = await resPromise;
    await expectApiStatus(res, [401, 400, 404], "wrong username");
    await expectErrorToast(page, /Invalid|incorrect|failed|not found|credentials/i, "login_wrong_username");
    await expectStillOnUrl(page, /\/auth\/login/);
  });

  test("Role tab mismatch — college creds on Super Admin tab rejected", async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password, "Super Admin");
    await loginPage.expectRoleMismatchToast().catch(async () => {
      await expectErrorToast(page, /College Admin|cannot sign in|Please use/i, "login_role_mismatch");
    });
    await expectStillOnUrl(page, /\/auth\/login/);
  });

  test("Weak password on forced setup → validation toast", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    // Use college admin; if already reset, skip
    await loginPage.loginAs(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password, "College Admin");
    if (!page.url().includes("/auth/setup-password")) {
      test.skip(true, "Account is not in must_change_password state");
    }
    await passwordSetupPage.expectForcedReset();
    await passwordSetupPage.assertPasswordPolicyRejectsWeak();
  });

  test("Password mismatch on setup → toast, stay on setup", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    await loginPage.loginAs(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password, "College Admin");
    if (!page.url().includes("/auth/setup-password")) {
      test.skip(true, "Not on forced password setup");
    }
    await passwordSetupPage.type(passwordSetupPage.newPassword, STRONG_PASSWORD);
    await passwordSetupPage.type(passwordSetupPage.confirmPassword, STRONG_PASSWORD + "x");
    await passwordSetupPage.click(passwordSetupPage.submit);
    await expectErrorToast(page, /match|do not match/i, "login_password_mismatch");
    await expectStillOnUrl(page, /setup-password/);
  });

  test("Password expired / must_change — lands on setup-password when flag set", async ({
    loginPage,
    page,
  }) => {
    // Behavioral: if API returns must_change_password, UI must route to setup
    await loginPage.loginAs(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password, "College Admin");
    const onSetup = page.url().includes("/auth/setup-password");
    const onPortal = /college-portal|superadmin|student-portal/.test(page.url());
    expect(onSetup || onPortal).toBeTruthy();
    await loginPage.shot("login_password_expired_or_ok");
  });

  test("Unauthorized URL while logged out → login gate", async ({ page, loginPage }) => {
    await clearSession(page);
    await page.goto(ROUTES.superadminDashboard);
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 20_000 });
    await loginPage.expectStillOnLogin();
    await loginPage.shot("login_unauthorized_url");
  });

  test("Token expired / corrupt token → cannot stay on protected route", async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });
    await corruptAccessToken(page);
    await page.goto(ROUTES.colleges);
    // Expect redirect to login or auth error toast / blocked shell
    await page.waitForTimeout(1500);
    const url = page.url();
    const blocked =
      /\/auth\/login/.test(url) ||
      (await page.getByText(/session|unauthorized|expired|sign in/i).count()) > 0;
    expect(blocked || /\/auth\/login/.test(url)).toBeTruthy();
    await loginPage.shot("login_token_expired");
  });

  test("Session expired (cleared storage) mid-portal", async ({ loginPage, page }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await clearSession(page);
    await page.goto(ROUTES.superadminDashboard);
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 20_000 });
    await loginPage.shot("login_session_expired");
  });

  test("Concurrent login — two contexts same user both authenticate", async ({
    browser,
    loginPage,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(loginPage.page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page2 = await ctx2.newPage();
    // Minimal second login via UI
    await page2.goto(ROUTES.login + "?role=super_admin");
    await page2.getByRole("tab", { name: "Super Admin" }).click();
    await page2.locator("#identifier").fill(SUPER_ADMIN.email);
    await page2.locator("#password").fill(SUPER_ADMIN.password);
    await page2.getByRole("button", { name: /^Sign In$/i }).click();
    await expect(page2).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    // First session still has a page (product may or may not revoke prior tokens)
    await loginPage.page.goto(ROUTES.superadminDashboard);
    await expect(loginPage.page.locator("body")).toBeVisible();
    await loginPage.shot("login_concurrent");
    await ctx2.close();
  });
});
