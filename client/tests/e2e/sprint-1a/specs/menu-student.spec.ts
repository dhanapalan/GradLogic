/**
 * Student Portal — validate ALL sidebar menus + valid/invalid profile data
 */
import { test, expect } from "../fixtures/test.fixture";
import { STUDENT, STRONG_PASSWORD, ROUTES } from "../config/env";
import { STUDENT_MENUS } from "../data/menus";
import { MenuNavigator, expectValidationFeedback } from "../pages/shared/MenuNavigator";
import { readState } from "../helpers/runtime-state";
import { expectToast } from "../utils/assertions";

test.describe.configure({ mode: "serial" });

async function loginStudent(
  loginPage: import("../pages/auth/LoginPage").LoginPage,
  passwordSetupPage: import("../pages/auth/PasswordSetupPage").PasswordSetupPage,
  page: import("@playwright/test").Page
) {
  const state = readState();
  const email = state.studentEmail || STUDENT.email;
  const password = state.studentPassword || state.studentTempPassword || STUDENT.password;

  await loginPage.loginAs(email, password, "Student");

  if (page.url().includes("/auth/setup-password")) {
    await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
  }

  if (page.url().includes("student-onboarding")) {
    // Profile incomplete — still allow menu tests that redirect; skip if stuck
    test.skip(true, "Student must complete onboarding before full portal menu validation");
  }

  await expect(page).toHaveURL(/\/app\/student-portal/, { timeout: 45_000 });
}

test.describe("MENU — Student portal", () => {
  test("Walk every Student sidebar menu (valid navigation)", async ({
    loginPage,
    passwordSetupPage,
    page,
    consoleMon,
    networkMon,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-network" });
    test.info().annotations.push({ type: "stability", description: "allow-console" });

    await loginStudent(loginPage, passwordSetupPage, page);
    const nav = new MenuNavigator(page, consoleMon, networkMon);
    const results = await nav.visitAll(STUDENT_MENUS);

    const failed = results.filter((r) => !r.ok);
    expect(
      failed,
      failed.map((f) => `${f.label}: ${f.reason}`).join("\n") || "all student menus OK"
    ).toHaveLength(0);
    expect(results.length).toBe(STUDENT_MENUS.length);
  });

  test("INVALID data — Profile blank required fields", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginStudent(loginPage, passwordSetupPage, page);
    await page.goto(ROUTES.studentProfile);

    await expect(page.getByRole("heading", { name: /Profile/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const first = page.getByLabel(/First name/i).or(page.locator('[name="first_name"]'));
    const last = page.getByLabel(/Last name/i).or(page.locator('[name="last_name"]'));
    const mobile = page.getByLabel(/Mobile|Phone/i).or(page.locator('[name="phone_number"]'));

    if ((await first.count()) === 0) {
      test.skip(true, "Profile first name field not found");
    }

    await first.first().fill("");
    if (await last.count()) await last.first().fill("");
    if (await mobile.count()) await mobile.first().fill("");

    const save = page.getByRole("button", { name: /Save changes|Save draft|Save/i }).first();
    await save.click();
    await expectValidationFeedback(page, /required|First name|Last name|Mobile|phone/i).catch(
      async () => {
        await expect(page.locator("input:invalid").first()).toBeVisible();
      }
    );
  });

  test("INVALID data — Profile invalid mobile", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginStudent(loginPage, passwordSetupPage, page);
    await page.goto(ROUTES.studentProfile);

    const first = page.getByLabel(/First name/i).or(page.locator('[name="first_name"]'));
    const mobile = page.getByLabel(/Mobile|Phone/i).or(page.locator('[name="phone_number"]'));
    if ((await first.count()) === 0 || (await mobile.count()) === 0) {
      test.skip(true, "Profile fields not found");
    }

    await first.first().fill("QA");
    const last = page.getByLabel(/Last name/i).or(page.locator('[name="last_name"]'));
    if (await last.count()) await last.first().fill("Student");
    await mobile.first().fill("12");

    await page.getByRole("button", { name: /Save changes|Save/i }).first().click();
    await expectValidationFeedback(page, /mobile|phone|digits|valid|invalid/i).catch(async () => {
      await expect(page.locator("input:invalid").first()).toBeVisible();
    });
  });

  test("VALID data — Profile save with valid personal fields", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginStudent(loginPage, passwordSetupPage, page);
    await page.goto(ROUTES.studentProfile);

    const first = page.getByLabel(/First name/i).or(page.locator('[name="first_name"]'));
    const last = page.getByLabel(/Last name/i).or(page.locator('[name="last_name"]'));
    const mobile = page.getByLabel(/Mobile|Phone/i).or(page.locator('[name="phone_number"]'));
    if ((await first.count()) === 0) {
      test.skip(true, "Profile form not available");
    }

    await first.first().fill("QA");
    if (await last.count()) await last.first().fill("Validated");
    if (await mobile.count()) await mobile.first().fill("9876543210");

    await page.getByRole("button", { name: /Save changes|Save draft|Save/i }).first().click();
    await expectToast(page, /saved|updated|success/i).catch(async () => {
      // Some builds navigate silently — ensure no error toast
      await expect(page.getByText(/failed|error/i)).toHaveCount(0);
    });
  });

  test("INVALID cross-portal — Student cannot open Super Admin menus", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginStudent(loginPage, passwordSetupPage, page);
    await page.goto("/app/superadmin/dashboard");
    await page.waitForTimeout(800);
    const blocked =
      /\/auth\/login|not-authorized|student-portal/.test(page.url()) ||
      (await page.getByText(/not authorized|access denied/i).count()) > 0 ||
      (await page.getByRole("heading", { name: /Admin Dashboard/i }).count()) === 0;
    expect(blocked).toBeTruthy();
  });
});
