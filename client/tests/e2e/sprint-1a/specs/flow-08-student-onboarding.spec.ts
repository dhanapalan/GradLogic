/**
 * FLOW 8 — Student Onboarding
 * Live wizard: Welcome → Personal → Academic → Skills → Career → Resume (skip) → Terms → Success
 */
import { test, expect } from "../fixtures/test.fixture";
import { STRONG_PASSWORD } from "../config/env";
import { readState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 8 — Student Onboarding", () => {
  test("8.1 Complete onboarding end-to-end (resume skipped)", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    const state = readState();
    test.skip(!state.studentEmail, "Requires Flow 6 student email in runtime state");

    const password = state.studentPassword || state.studentTempPassword || STRONG_PASSWORD;
    await loginPage.loginAs(state.studentEmail!, password, "Student");

    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }

    // Force onboarding route if profile incomplete
    if (!page.url().includes("student-onboarding")) {
      await page.goto("/student-onboarding");
    }

    await studentOnboarding.expectOnboarding();

    // Welcome may already be past depending on resume — handle both
    const welcomeVisible = await page.getByText(/Welcome/i).first().isVisible().catch(() => false);
    if (welcomeVisible) await studentOnboarding.completeWelcome();

    await studentOnboarding.completePersonal({
      first_name: "QA",
      last_name: "Student",
      phone_number: "9876543210",
      dob: "2002-01-15",
    });

    await studentOnboarding.completeAcademic({
      degree: "B.Tech",
      specialization: "Computer Science",
      roll_number: state.studentRoll || `QA${Date.now().toString().slice(-6)}`,
      course_start_year: "2022",
    });

    await studentOnboarding.completeSkills("Java, Python, Problem Solving");
    await studentOnboarding.completeCareer("Full-stack engineer and campus placements");
    await studentOnboarding.skipResume();
    await studentOnboarding.completeTermsAndSubmit();
    await studentOnboarding.goToStudentPortal();

    await expect(page).toHaveURL(/student-portal|student-onboarding/, { timeout: 30_000 });
  });
});
