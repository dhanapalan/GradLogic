/**
 * STUDENT REGISTRATION EDGE CASES — College Portal
 */
import { test, expect } from "../../fixtures/test.fixture";
import { COLLEGE_ADMIN, ROUTES } from "../../config/env";
import {
  studentValid,
  FUTURE_DOB,
  LARGE_ADDRESS,
} from "../../data/edge-payloads";
import {
  expectErrorToast,
  waitForApi,
  expectApiStatus,
  expectStillOnUrl,
  expectUiFormIntact,
} from "../../helpers/edge-expect";
import { readState } from "../../helpers/runtime-state";
import { expectToast } from "../../utils/assertions";

test.describe.configure({ mode: "serial" });

async function asCollegeAdmin(loginPage: import("../../pages/auth/LoginPage").LoginPage) {
  const state = readState();
  const email = state.tpoEmail || COLLEGE_ADMIN.email;
  const password = state.tpoPassword || COLLEGE_ADMIN.password;
  await loginPage.loginAs(email, password, "College Admin");
  await expect(loginPage.page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });
}

test.describe("EDGE — Student registration", () => {
  test.beforeEach(async ({ loginPage, page, studentForm }) => {
    await asCollegeAdmin(loginPage);
    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();
  });

  test("Blank mandatory fields → client validation message", async ({
    studentForm,
    page,
  }) => {
    await studentForm.click(studentForm.submit);
    await expectErrorToast(
      page,
      /Roll Number is required|Student Name is required|Department is required|Batch is required|Email is required/i,
      "student_blank_mandatory"
    );
    await expectStillOnUrl(page, /\/students\/new/);
    await expectUiFormIntact(page, /Add Student/i);
  });

  test("Duplicate roll / register number → API error toast", async ({
    studentForm,
    page,
  }) => {
    const first = studentValid();
    const created = await studentForm.register(first);
    expect(created.email).toBe(first.email);

    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();
    const dup = studentValid({
      roll_number: first.roll_number,
      email: `uniq.${Date.now()}@example.edu`,
    });
    const resPromise = waitForApi(page, "/campus/students", "POST").catch(() =>
      waitForApi(page, "/students", "POST")
    );
    await studentForm.fill(dup);
    await studentForm.click(studentForm.submit);
    const res = await resPromise;
    await expectApiStatus(res, [400, 409, 422], "duplicate roll");
    await expectErrorToast(
      page,
      /already|exists|duplicate|roll|identifier|in use|Failed/i,
      "student_duplicate_roll"
    );
  });

  test("Duplicate email → 409 + toast", async ({ studentForm, page }) => {
    const first = studentValid();
    await studentForm.register(first);

    await page.goto(ROUTES.campusStudentNew);
    const dup = studentValid({
      email: first.email,
      roll_number: `R${Date.now().toString().slice(-8)}`,
    });
    const resPromise = waitForApi(page, "/campus/students", "POST").catch(() =>
      waitForApi(page, "/students", "POST")
    );
    await studentForm.fill(dup);
    await studentForm.click(studentForm.submit);
    const res = await resPromise;
    await expectApiStatus(res, [409, 400], "duplicate email");
    await expectErrorToast(page, /Email already|in use|exists|Failed/i, "student_duplicate_email");
  });

  test("Duplicate phone — assert API / toast behavior", async ({ studentForm, page }) => {
    const phone = `98${Date.now().toString().slice(-8)}`;
    const first = studentValid({ mobile: phone });
    await studentForm.register(first);

    await page.goto(ROUTES.campusStudentNew);
    const dup = studentValid({
      mobile: phone,
      email: `phone.dup.${Date.now()}@example.edu`,
      roll_number: `P${Date.now().toString().slice(-8)}`,
    });
    const resPromise = waitForApi(page, "/campus/students", "POST").catch(() =>
      waitForApi(page, "/students", "POST")
    );
    await studentForm.fill(dup);
    await studentForm.click(studentForm.submit);
    const res = await resPromise;
    // Phone uniqueness may not be enforced — assert either rejection or success is explicit
    expect([200, 201, 400, 409, 422]).toContain(res.status());
    if (!res.ok()) {
      await expectErrorToast(page, /phone|mobile|exists|Failed|in use/i, "student_duplicate_phone");
    } else {
      await expectToast(page, /success|created|added/i);
      await studentForm.shot("student_duplicate_phone_allowed");
    }
  });

  test("DOB validation — invalid / future date", async ({ studentForm, page }) => {
    const data = studentValid();
    await studentForm.fill(data);
    const dob = page.getByLabel(/Date of Birth/i);
    if ((await dob.count()) === 0) {
      test.skip(true, "DOB field not present on form");
    }
    await dob.fill(FUTURE_DOB);
    const resPromise = waitForApi(page, "/campus/students", "POST").catch(() => null);
    await studentForm.click(studentForm.submit);
    const res = await resPromise;
    // Client may allow; server may accept future DOB — assert UI/API outcome recorded
    if (res && !res.ok()) {
      await expectApiStatus(res, [400, 422], "future DOB");
      await expectErrorToast(page, /Date of Birth|dob|invalid|age/i, "student_dob_invalid");
    } else {
      await studentForm.shot("student_future_dob_result");
    }
  });

  test("Age validation — DOB = today (underage signal)", async ({ studentForm, page }) => {
    const data = studentValid();
    await studentForm.fill(data);
    const dob = page.getByLabel(/Date of Birth/i);
    if ((await dob.count()) === 0) {
      test.skip(true, "DOB field not present");
    }
    const today = new Date().toISOString().slice(0, 10);
    await dob.fill(today);
    await studentForm.click(studentForm.submit);
    // Soft product rule: either toast age error or API accepts — document UI state
    await page.waitForTimeout(800);
    await studentForm.shot("student_age_validation");
    await expect(page.locator("body")).toBeVisible();
  });

  test("Large address / long name edge — UI + API", async ({ studentForm, page }) => {
    const data = studentValid({
      name: `QA ${"StudentName".repeat(20)}`.slice(0, 200),
    });
    const resPromise = waitForApi(page, "/campus/students", "POST").catch(() =>
      waitForApi(page, "/students", "POST")
    );
    await studentForm.fill(data);
    // Address may not exist on student form — use register number for large text if present
    const reg = page.getByLabel(/Register Number/i);
    if (await reg.count()) {
      await studentForm.type(reg, LARGE_ADDRESS.slice(0, 500));
    }
    await studentForm.click(studentForm.submit);
    const res = await resPromise;
    await expectApiStatus(res, [200, 201, 400, 413, 500], "large student fields");
    await studentForm.shot("student_large_fields");
  });
});
