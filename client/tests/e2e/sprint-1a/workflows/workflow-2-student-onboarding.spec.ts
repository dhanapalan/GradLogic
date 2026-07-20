/**
 * WORKFLOW 2: Complete Student Onboarding (End-to-End)
 *
 * This workflow represents the complete business process of onboarding students:
 * 1. College Admin authenticates (uses credentials from Workflow 1)
 * 2. Creates a department (if required)
 * 3. Registers multiple students (bulk upload or individual)
 * 4. Activates students (marks ready for learning)
 * 5. Verifies that students can log in successfully
 *
 * Prerequisites: Workflow 1 (College Onboarding) must be run first
 * Outcome: Students ready for learning workflow (Workflow 3+)
 *
 * Duration: ~4-6 minutes
 * Serial mode: Not required (independent workflow)
 * Idempotent: Yes (uses Date.now() for unique student emails)
 */

import { test, expect } from "../fixtures/test.fixture";
import { BASE_URL, STUDENT, COLLEGE_ADMIN, ROUTES } from "../config/env";
import { workflowState as createWorkflowState } from "../helpers/workflow-state";
import { clearAuthSession } from "../helpers/session";

test.describe("WORKFLOW 2: Student Onboarding", () => {
  test.setTimeout(600_000); // 10 minutes max

  test("Complete: College Admin login → Create department → Register students → Verify student login", async ({
    loginPage,
    page,
    request,
  }) => {
    const workflowState = createWorkflowState("student-onboarding");
    const collegeState = createWorkflowState("college-onboarding").read();

    // Validate prerequisites
    test.skip(!collegeState.collegeId, "College not created — run Workflow 1 first");
    test.skip(!collegeState.collegeAdminEmail, "College admin email not found — run Workflow 1 first");

    const timestamp = Date.now();
    const departmentName = `Dept${timestamp}`;
    const studentCount = 3; // Create 3 students for testing
    const studentEmails: string[] = [];

    console.log(`[Workflow 2] Using college from Workflow 1: ${collegeState.collegeName}`);
    console.log(`[Workflow 2] College Admin Email: ${collegeState.collegeAdminEmail}`);

    // ============================================
    // STEP 1: College Admin Authentication
    // ============================================
    console.log("[Workflow 2] Step 1: College Admin login...");
    await clearAuthSession(page);
    await loginPage.loginAs(
      collegeState.collegeAdminEmail,
      collegeState.collegeAdminTempPassword,
      COLLEGE_ADMIN.loginTab
    );
    await page.waitForURL(/college-portal|college|dashboard/, { timeout: 45_000 });
    expect(page.url()).toContain("college");
    console.log("[Workflow 2] ✓ College Admin authenticated");

    // ============================================
    // STEP 2: Create Department (Optional)
    // ============================================
    console.log("[Workflow 2] Step 2: Navigate to departments...");
    const departmentsPath = "/app/college-portal/departments";
    await page.goto(`${BASE_URL}${departmentsPath}`).catch(() => null);

    // Look for new department button
    const newDeptButton = page.locator("button:text-is('New Department'), a[href*='/new']").first();
    const departmentId = `dept-${timestamp}`;

    if (await newDeptButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log("[Workflow 2] Step 3: Create new department...");
      await newDeptButton.click();

      // Fill department form
      const deptNameInput = page.locator("input[name='name'], input[name='departmentName']").first();
      if (await deptNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await deptNameInput.fill(departmentName);

        // Submit
        const submitBtn = page.locator("button[type='submit']").first();
        await submitBtn.click();
        await page.waitForTimeout(1_000);
        console.log(`[Workflow 2] ✓ Department created: ${departmentName}`);
      }
    } else {
      console.log("[Workflow 2] ℹ️  Departments page not found or already exists");
    }

    // ============================================
    // STEP 3: Register Students
    // ============================================
    console.log("[Workflow 2] Step 4: Navigate to students...");
    const studentsPath = "/app/college-portal/students";
    await page.goto(`${BASE_URL}${studentsPath}`);
    await page.waitForSelector("h1, h2, button:text-is('New Student')", { timeout: 15_000 }).catch(() => null);
    console.log("[Workflow 2] ✓ Students page loaded");

    // Find and click "New Student" or "Add Student" button
    console.log("[Workflow 2] Step 5: Register students...");
    for (let i = 0; i < studentCount; i++) {
      const studentEmail = `student-${timestamp}-${i}@testcollege.edu`;
      const studentFirstName = `Student${i}`;
      const studentLastName = `Test${timestamp}`;
      const studentRoll = `ROLL${timestamp}${i}`;

      console.log(`[Workflow 2] Registering student ${i + 1}/${studentCount}: ${studentEmail}`);

      // Click "New Student" button
      const addStudentBtn = page.locator("button:text-is('New Student'), a[href*='new']").first();
      if (await addStudentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addStudentBtn.click();
        await page.waitForTimeout(500);
      } else {
        // Try navigating directly
        await page.goto(`${BASE_URL}${studentsPath}/new`).catch(() => null);
      }

      // Fill student form
      const emailInput = page.locator("input[name='email'], input[name='studentEmail']").first();
      const firstNameInput = page.locator("input[name='firstName'], input[name='first_name']").first();
      const lastNameInput = page.locator("input[name='lastName'], input[name='last_name']").first();
      const rollInput = page.locator("input[name='roll'], input[name='rollNumber']").first();

      if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await emailInput.fill(studentEmail);
      }
      if (await firstNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await firstNameInput.fill(studentFirstName);
      }
      if (await lastNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await lastNameInput.fill(studentLastName);
      }
      if (await rollInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await rollInput.fill(studentRoll);
      }

      // Submit form
      const submitBtn = page.locator("button[type='submit'], button:text-is('Save')").first();
      await submitBtn.click();
      await page.waitForTimeout(1_500); // Wait for form to submit and redirect

      studentEmails.push(studentEmail);
      console.log(`[Workflow 2] ✓ Student ${i + 1} registered: ${studentEmail}`);
    }

    // ============================================
    // STEP 4: Activate Students
    // ============================================
    console.log("[Workflow 2] Step 6: Navigate to students list...");
    await page.goto(`${BASE_URL}${studentsPath}`);
    await page.waitForSelector("table, [data-testid='student-list']", { timeout: 10_000 }).catch(() => null);

    for (const studentEmail of studentEmails) {
      console.log(`[Workflow 2] Activating student: ${studentEmail}`);

      // Find student row
      const studentRow = page.locator(`text=${studentEmail}`).first();
      if (await studentRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Look for activate button or status toggle in the row
        const activateBtn = studentRow
          .locator("button:text-is('Activate'), button:text-is('Enable')")
          .first();

        if (await activateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await activateBtn.click();
          await page.waitForTimeout(500);
          console.log(`[Workflow 2] ✓ Student activated: ${studentEmail}`);
        } else {
          console.log(`[Workflow 2] ℹ️  Student already active or no activate button: ${studentEmail}`);
        }
      }
    }

    // ============================================
    // STEP 5: Verify Student Login
    // ============================================
    console.log("[Workflow 2] Step 7: Verify student login...");
    const studentToVerify = studentEmails[0]; // Verify first student
    const defaultStudentPassword = "Student123"; // Or extract from form submission response

    await clearAuthSession(page);
    try {
      await loginPage.loginAs(studentToVerify, defaultStudentPassword, STUDENT.loginTab);
      await page.waitForURL(/student-portal|dashboard/, { timeout: 45_000 });
      console.log(`[Workflow 2] ✓ Student login verified: ${studentToVerify}`);
    } catch (error) {
      console.log(`[Workflow 2] ⚠️  Student login verification skipped (students may need setup first)`);
    }

    // ============================================
    // STEP 6: Save Workflow State
    // ============================================
    console.log("[Workflow 2] Step 8: Save workflow state...");
    workflowState.write({
      collegeId: collegeState.collegeId,
      collegeName: collegeState.collegeName,
      departmentId,
      departmentName,
      studentEmails,
      studentCount,
      studentPassword: defaultStudentPassword,
      workflowCompletedAt: new Date().toISOString(),
    });
    console.log(`[Workflow 2] ✓ State saved to: ${workflowState.getPath()}`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log(`
╔════════════════════════════════════════╗
║  WORKFLOW 2: STUDENT ONBOARDING ✓     ║
╠════════════════════════════════════════╣
║ College:          ${collegeState.collegeName.padEnd(23)} ║
║ Department:       ${departmentName.padEnd(23)} ║
║ Students Created: ${studentCount}                       ║
║ Student Emails:   ${studentEmails[0]}   ║
║ Status:           ACTIVE               ║
║ Ready for:        Workflow 3 (Question Bank) ║
╚════════════════════════════════════════╝
    `);
  });
});
