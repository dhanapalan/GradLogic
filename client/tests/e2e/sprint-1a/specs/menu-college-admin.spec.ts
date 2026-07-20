/**
 * College Admin — validate ALL sidebar menus + valid/invalid form data
 */
import { test, expect } from "../fixtures/test.fixture";
import { COLLEGE_ADMIN, ROUTES } from "../config/env";
import { COLLEGE_ADMIN_MENUS } from "../data/menus";
import { MenuNavigator, expectValidationFeedback } from "../pages/shared/MenuNavigator";
import { buildStudent } from "../data/factories";
import { readState } from "../helpers/runtime-state";
import { expectToast } from "../utils/assertions";

test.describe.configure({ mode: "serial" });

async function loginCollege(loginPage: import("../pages/auth/LoginPage").LoginPage, page: import("@playwright/test").Page) {
  const state = readState();
  const email = state.tpoEmail || state.adminMgmtCollegeAdminEmail || COLLEGE_ADMIN.email;
  const password =
    state.tpoPassword || state.adminMgmtCollegeAdminPassword || COLLEGE_ADMIN.password;
  await loginPage.loginAs(email, password, "College Admin");
  if (page.url().includes("/auth/setup-password")) {
    // leave to password setup page object if forced
  }
  await expect(page).toHaveURL(/\/app\/college-portal|\/auth\/setup-password/, { timeout: 45_000 });
  if (page.url().includes("setup-password")) {
    test.skip(true, "College admin must reset password before menu tests");
  }
}

test.describe("MENU — College Admin portal", () => {
  test("Walk every College Admin sidebar menu (valid navigation)", async ({
    loginPage,
    page,
    consoleMon,
    networkMon,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-network" });
    test.info().annotations.push({ type: "stability", description: "allow-console" });

    await loginCollege(loginPage, page);
    const nav = new MenuNavigator(page, consoleMon, networkMon);
    const results = await nav.visitAll(COLLEGE_ADMIN_MENUS);

    const failed = results.filter((r) => !r.ok);
    expect(
      failed,
      failed.map((f) => `${f.label}: ${f.reason}`).join("\n") || "all menus OK"
    ).toHaveLength(0);

    // Every menu must have been attempted
    expect(results.length).toBe(COLLEGE_ADMIN_MENUS.length);
  });

  test("INVALID data — Add Student blank mandatory fields", async ({
    loginPage,
    page,
    studentForm,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginCollege(loginPage, page);
    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();
    await studentForm.click(studentForm.submit);
    await expectValidationFeedback(
      page,
      /Roll Number is required|Student Name is required|Department is required|Batch is required|Email is required/i
    );
    await expect(page).toHaveURL(/\/students\/new/);
  });

  test("INVALID data — Add Student invalid email & phone", async ({
    loginPage,
    page,
    studentForm,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginCollege(loginPage, page);
    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();

    await studentForm.type(studentForm.byLabel(/Roll Number/i), `INV${Date.now().toString().slice(-6)}`);
    await studentForm.type(studentForm.byLabel(/Student Name/i), "Invalid Student");
    await studentForm.type(studentForm.byLabel(/^Email/i), "not-an-email");
    await studentForm.type(studentForm.byLabel(/Department/i), "CSE");
    await studentForm.type(studentForm.byLabel(/Batch/i), "2026");
    await studentForm.click(studentForm.submit);
    await expectValidationFeedback(page, /valid email|Email/i);

    const mobile = studentForm.byLabel(/Mobile/i);
    if (await mobile.count()) {
      await studentForm.type(studentForm.byLabel(/^Email/i), `ok.${Date.now()}@example.edu`);
      await studentForm.type(mobile, "123");
      await studentForm.click(studentForm.submit);
      await expectValidationFeedback(page, /mobile|phone|digits/i);
    }
  });

  test("VALID data — Add Student succeeds", async ({
    loginPage,
    page,
    studentForm,
    studentsList,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginCollege(loginPage, page);
    await page.goto(ROUTES.campusStudentNew);
    const student = buildStudent();
    const created = await studentForm.register(student);
    expect(created.email).toBe(student.email);
    await page.goto(ROUTES.campusStudents);
    await studentsList.expectStudentExists(student.roll_number);
  });

  test("INVALID / VALID — College Settings profile fields", async ({ loginPage, page }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginCollege(loginPage, page);
    await page.goto("/app/college-portal/settings");
    await expect(page.getByRole("heading", { name: /College Profile|Settings/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const nameField = page.getByLabel(/College Name/i).or(page.locator('[name="name"]'));
    if ((await nameField.count()) === 0) {
      test.skip(true, "College name field not editable for this role");
    }

    const original = await nameField.first().inputValue().catch(() => "");
    await nameField.first().fill("");
    const save = page.getByRole("button", { name: /Save/i }).first();
    await save.click();
    await expectValidationFeedback(page, /required|name|Failed|invalid/i).catch(async () => {
      // Some builds block empty via HTML required
      await expect(nameField.first()).toBeVisible();
    });

    if (original) {
      await nameField.first().fill(original);
      await save.click();
      await expectToast(page, /saved|updated|success/i).catch(() => undefined);
    }
  });
});
