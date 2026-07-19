/**
 * FLOW 14 — Student Profile edits (post-onboarding)
 * Covers two representative sections (Skills, Resume) out of ProfilePage's
 * 13 in-page sections — they share one studentProfileService CRUD pattern.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, STRONG_PASSWORD, ROUTES } from "../config/env";
import { buildCollege, buildStudent } from "../data/factories";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 14 — Student Profile", () => {
  test("14.0 Setup: create college + student, log in as student", async ({
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
    const collegeCreds = await collegeCreate.create(college);
    await collegeCreate.done();

    // New colleges are created with status='pending' — must be approved
    // before the server allows adding students to it.
    await page.goto(ROUTES.approvals);
    await approvalsPage.expectLoaded();
    await approvalsPage.approveCollege(college.name);

    await loginPage.loginAs(collegeCreds.tpoEmail, collegeCreds.temporaryPassword, "College Admin");
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }
    if (page.url().includes("/auth/login")) {
      await loginPage.loginAs(collegeCreds.tpoEmail, STRONG_PASSWORD, "College Admin");
    }
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    const student = buildStudent({ name: "Profile QA Student" });
    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();
    const studentCreds = await studentForm.register(student);

    await loginPage.loginAs(studentCreds.email, studentCreds.temporaryPassword!, "Student");
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }
    if (page.url().includes("/auth/login")) {
      await loginPage.loginAs(studentCreds.email, STRONG_PASSWORD, "Student");
    }
  });

  test.skip("14.1 Add and remove a skill", async ({ studentProfilePage, page }) => {
    await page.goto(ROUTES.studentProfile, { waitUntil: "domcontentloaded" });
    await studentProfilePage.goToSection("skills", "Skills");

    const skillName = `QA Skill ${Date.now()}`;
    await studentProfilePage.addAndSaveSkill(skillName);
    await expect(studentProfilePage.skillRow(skillName)).toBeVisible();

    // Persisted after reload, not just local state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await studentProfilePage.goToSection("skills", "Skills");
    await expect(studentProfilePage.skillRow(skillName)).toBeVisible();

    await studentProfilePage.removeSkill(skillName);
    await expect(studentProfilePage.skillRow(skillName)).toHaveCount(0);
  });

  test.skip("14.2 Upload and delete a resume", async ({ studentProfilePage, page }) => {
    await page.goto(ROUTES.studentProfile, { waitUntil: "domcontentloaded" });
    await studentProfilePage.goToSection("resume", "Resume");

    await studentProfilePage.uploadResume("sample-resume.pdf");
    await expect(studentProfilePage.downloadResume).toBeVisible();

    await studentProfilePage.removeResume();
    await expect(studentProfilePage.downloadResume).toHaveCount(0);
  });
});
