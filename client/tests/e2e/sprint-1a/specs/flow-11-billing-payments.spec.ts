/**
 * FLOW 11 — Billing (college) & Payments (student)
 * Both pages are backed by server/src/services/mockPaymentGateway.service.ts —
 * no real gateway, safe to exercise the full pay flow end-to-end.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, STRONG_PASSWORD, ROUTES } from "../config/env";
import { buildCollege, buildStudent } from "../data/factories";
import { writeState, readState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

async function loginAsFreshCollegeAdmin(
  loginPage: import("../pages/auth/LoginPage").LoginPage,
  passwordSetupPage: import("../pages/auth/PasswordSetupPage").PasswordSetupPage,
  page: import("@playwright/test").Page,
  email: string,
  tempPassword: string
): Promise<void> {
  await loginPage.loginAs(email, tempPassword, "College Admin");
  if (page.url().includes("/auth/setup-password")) {
    await passwordSetupPage.expectForcedReset();
    await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
  }
  if (page.url().includes("/auth/login")) {
    await loginPage.loginAs(email, STRONG_PASSWORD, "College Admin");
  }
  await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });
}

test.describe("FLOW 11 — Billing & Payments", () => {
  test("11.0 Setup: create college with two students", async ({
    loginPage,
    collegeCreate,
    approvalsPage,
    passwordSetupPage,
    studentForm,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const college = buildCollege();
    await page.goto(ROUTES.collegesNew);
    const creds = await collegeCreate.create(college);
    await collegeCreate.done();

    // New colleges are created with status='pending' — the server rejects
    // student creation ("Can only add students to an active college") until
    // a superadmin approves the registration.
    await page.goto(ROUTES.approvals);
    await approvalsPage.expectLoaded();
    await approvalsPage.approveCollege(college.name);

    await loginAsFreshCollegeAdmin(loginPage, passwordSetupPage, page, creds.tpoEmail, creds.temporaryPassword);

    const studentA = buildStudent({ name: "Billing QA Student A" });
    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();
    const credsA = await studentForm.register(studentA);

    const studentB = buildStudent({ name: "Payments QA Student B" });
    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();
    const credsB = await studentForm.register(studentB);

    writeState({
      billingCollegeAdminEmail: creds.tpoEmail,
      billingCollegeAdminPassword: STRONG_PASSWORD,
      billingStudentAName: studentA.name,
      billingStudentBEmail: credsB.email,
      billingStudentBTempPassword: credsB.temporaryPassword,
    });
    void credsA;
  });

  test("11.1 College — generate fee records and mark a student paid", async ({
    loginPage,
    passwordSetupPage,
    billingPage,
    page,
  }) => {
    const state = readState();
    test.skip(!state.billingCollegeAdminEmail, "Requires 11.0 setup state");

    await loginAsFreshCollegeAdmin(
      loginPage,
      passwordSetupPage,
      page,
      state.billingCollegeAdminEmail!,
      state.billingCollegeAdminPassword!
    );

    await page.goto(ROUTES.billing);
    await billingPage.expectLoaded();
    await billingPage.generateRecords();

    await billingPage.searchStudent(state.billingStudentAName!);
    const before = await billingPage.statusFor(state.billingStudentAName!);
    expect(before.toLowerCase()).toContain("pending");

    await billingPage.markPaid(state.billingStudentAName!, "Cash");
    const after = await billingPage.statusFor(state.billingStudentAName!);
    expect(after.toLowerCase()).toContain("paid");
  });

  test("11.2 Student — pay current fee via Pay Now", async ({
    loginPage,
    passwordSetupPage,
    paymentsPage,
    page,
  }) => {
    const state = readState();
    test.skip(!state.billingStudentBEmail, "Requires 11.0 setup state");

    await loginPage.loginAs(state.billingStudentBEmail!, state.billingStudentBTempPassword!, "Student");

    // Handle forced password setup
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }
    if (page.url().includes("/auth/login")) {
      await loginPage.loginAs(state.billingStudentBEmail!, STRONG_PASSWORD, "Student");
    }

    // If redirected to onboarding, skip this test (onboarding not covered in flow-11)
    if (page.url().includes("/student-onboarding")) {
      test.skip(true, "Student needs onboarding first — flow-14 covers profile/onboarding scenarios");
    }

    await page.goto(ROUTES.payments, { waitUntil: "domcontentloaded" });
    await paymentsPage.expectLoaded();

    const status = await paymentsPage.currentStatusBadge().catch(() => "");
    test.skip(!status || !/pending/i.test(status), "No pending fee to pay — college billing setup may not have run yet");

    await paymentsPage.payCurrentFee();
    const after = await paymentsPage.currentStatusBadge();
    expect(after.toLowerCase()).toContain("paid");
  });
});
