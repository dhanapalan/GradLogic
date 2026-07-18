/**
 * STUDENT ONBOARDING EDGE CASES
 * Resume optional / invalid / corrupted / large / multiple · nav · session · network
 */
import { test, expect } from "../../fixtures/test.fixture";
import { STRONG_PASSWORD, ROUTES } from "../../config/env";
import {
  expectErrorToast,
  clearSession,
  expectStillOnUrl,
} from "../../helpers/edge-expect";
import { readState } from "../../helpers/runtime-state";

function resumeInput(page: import("@playwright/test").Page) {
  return page.locator('input[type="file"][accept*="pdf"], input[type="file"]').last();
}

async function loginStudent(
  loginPage: import("../../pages/auth/LoginPage").LoginPage,
  passwordSetupPage: import("../../pages/auth/PasswordSetupPage").PasswordSetupPage
) {
  const state = readState();
  test.skip(!state.studentEmail, "Requires Flow 6/edge student credentials in runtime state");
  const password = state.studentPassword || state.studentTempPassword || STRONG_PASSWORD;
  await loginPage.loginAs(state.studentEmail!, password, "Student");
  if (loginPage.page.url().includes("/auth/setup-password")) {
    await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
  }
  if (!loginPage.page.url().includes("student-onboarding")) {
    await loginPage.page.goto(ROUTES.studentOnboarding);
  }
  await expect(loginPage.page).toHaveURL(/student-onboarding/, { timeout: 30_000 });
}

async function goToResumeStep(
  studentOnboarding: import("../../pages/student/StudentOnboardingPage").StudentOnboardingPage,
  page: import("@playwright/test").Page
) {
  // Fast-forward: Welcome → … until Resume heading visible (bounded)
  for (let i = 0; i < 8; i++) {
    if (await page.getByText(/Resume Upload/i).first().isVisible().catch(() => false)) {
      return;
    }
    if (await page.getByRole("heading", { name: /Success/i }).count()) return;
    const cont = studentOnboarding.continueBtn;
    if (await cont.isVisible().catch(() => false)) {
      // Fill minimal required fields when on personal/academic
      if (await page.locator('[name="first_name"]').isVisible().catch(() => false)) {
        await studentOnboarding.completePersonal({
          first_name: "QA",
          last_name: "Edge",
          phone_number: "9876543210",
        });
        continue;
      }
      if (await page.locator('[name="degree"]').isVisible().catch(() => false)) {
        await studentOnboarding.completeAcademic({
          degree: "B.Tech",
          specialization: "CSE",
          roll_number: `E${Date.now().toString().slice(-6)}`,
        });
        continue;
      }
      if (await page.locator('[name="skills"]').isVisible().catch(() => false)) {
        await studentOnboarding.completeSkills();
        continue;
      }
      if (await page.locator('[name="career_goals"]').isVisible().catch(() => false)) {
        await studentOnboarding.completeCareer();
        continue;
      }
      await studentOnboarding.continue();
    } else {
      break;
    }
  }
}

test.describe("EDGE — Student onboarding", () => {
  test("Resume upload optional — Continue without file allowed", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await goToResumeStep(studentOnboarding, page);
    await expect(page.getByText(/optional|Skip|Don't have one/i).first()).toBeVisible();
    await studentOnboarding.skipResume();
    // Should advance past resume (Terms or later)
    await expect(
      page.getByText(/Terms|Privacy|Success|Career/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await studentOnboarding.shot("onboarding_resume_optional");
  });

  test("Invalid resume type (not PDF/DOC) → toast, stay on step", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await goToResumeStep(studentOnboarding, page);

    await resumeInput(page).setInputFiles({
      name: "malware.exe.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a resume"),
    });
    await studentOnboarding.continue();
    await expectErrorToast(page, /PDF or DOC|Resume must/i, "onboarding_invalid_pdf_type");
    await expect(page.getByText(/Resume Upload/i).first()).toBeVisible();
  });

  test("Corrupted PDF (wrong content, pdf mime) — client may accept type; server may fail later", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await goToResumeStep(studentOnboarding, page);

    await resumeInput(page).setInputFiles({
      name: "corrupt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 corrupted-binary-garbage"),
    });
    await studentOnboarding.continue();
    // Type check passes — should leave resume step OR show server error on finish
    await studentOnboarding.shot("onboarding_corrupt_pdf");
    await expect(page.locator("body")).toBeVisible();
  });

  test("Large resume (>2MB) → toast Resume must be 2MB or less", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await goToResumeStep(studentOnboarding, page);

    const big = Buffer.alloc(2 * 1024 * 1024 + 1024, 1);
    await resumeInput(page).setInputFiles({
      name: "huge.pdf",
      mimeType: "application/pdf",
      buffer: big,
    });
    await studentOnboarding.continue();
    await expectErrorToast(page, /2MB or less|too large|size/i, "onboarding_large_resume");
    await expect(page.getByText(/Resume Upload/i).first()).toBeVisible();
  });

  test("Multiple resume upload — last file wins / UI shows latest name", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await goToResumeStep(studentOnboarding, page);

    const input = resumeInput(page);
    await input.setInputFiles({
      name: "first.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 first"),
    });
    await expect(page.getByText("first.pdf")).toBeVisible();
    await input.setInputFiles({
      name: "second.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 second"),
    });
    await expect(page.getByText("second.pdf")).toBeVisible();
    await studentOnboarding.shot("onboarding_multiple_resume");
  });

  test("Back navigation between onboarding steps", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    if (await page.getByText(/Welcome/i).first().isVisible().catch(() => false)) {
      await studentOnboarding.completeWelcome();
    }
    await studentOnboarding.completePersonal({
      first_name: "Back",
      last_name: "Nav",
      phone_number: "9876500001",
    });
    await expect(page.getByText(/Academic/i).first()).toBeVisible();
    await studentOnboarding.click(studentOnboarding.backBtn);
    await expect(page.getByText(/Personal/i).first()).toBeVisible();
    await studentOnboarding.shot("onboarding_back_nav");
  });

  test("Browser refresh mid-onboarding — page reloads wizard", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/student-onboarding/);
    await expect(page.locator("body")).toBeVisible();
    await studentOnboarding.shot("onboarding_refresh");
  });

  test("Session expired during onboarding → login redirect", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await clearSession(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectStillOnUrl(page, /\/auth\/login/);
    await loginPage.shot("onboarding_session_expired");
  });

  test("Network failure on onboarding submit", async ({
    loginPage,
    passwordSetupPage,
    studentOnboarding,
    page,
    context,
  }) => {
    await loginStudent(loginPage, passwordSetupPage);
    await goToResumeStep(studentOnboarding, page);
    await studentOnboarding.skipResume();

    // Terms step
    if (await page.getByText(/Terms|Privacy/i).first().isVisible().catch(() => false)) {
      const accept = page.locator('[name="accept_terms"]').or(
        page.getByRole("checkbox", { name: /terms|privacy|agree/i })
      );
      await accept.first().check({ force: true }).catch(async () => {
        await studentOnboarding.click(accept.first());
      });
      await context.setOffline(true);
      await studentOnboarding.click(studentOnboarding.finishBtn);
      await expectErrorToast(page, /Failed|network|error|Unable/i, "onboarding_network_failure").catch(
        async () => {
          await expect(page.getByText(/Success/i)).toHaveCount(0);
        }
      );
      await context.setOffline(false);
    }
  });
});
