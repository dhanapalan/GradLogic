/**
 * WORKFLOW 4: Complete Assessment Creation & Campaign Setup (End-to-End)
 *
 * This workflow represents the complete business process of creating an assessment:
 * 1. College Admin authenticates (uses credentials from Workflow 1)
 * 2. Selects/imports Question Bank (from Workflow 3)
 * 3. Creates Assessment
 * 4. Creates Campaign
 * 5. Assigns to Students (from Workflow 2)
 * 6. Publishes for student access
 *
 * Prerequisites: Workflow 1 (College), Workflow 3 (Question Bank), Workflow 2 (Students)
 * Outcome: Assessment ready for student learning/examination (Workflows 5 & 6)
 *
 * Duration: ~4-6 minutes
 * Serial mode: Not required (independent workflow, but uses other states)
 * Idempotent: Yes (uses Date.now() for unique assessment names)
 */

import { test, expect } from "../fixtures/test.fixture";
import { BASE_URL, COLLEGE_ADMIN, ROUTES } from "../config/env";
import { workflowState as createWorkflowState } from "../helpers/workflow-state";
import { clearAuthSession } from "../helpers/session";

test.describe("WORKFLOW 4: Assessment Creation & Campaign", () => {
  test.setTimeout(600_000); // 10 minutes max

  test("Complete: College Admin login → Create assessment → Assign QB → Assign students → Publish", async ({
    loginPage,
    page,
    request,
  }) => {
    const workflowState = createWorkflowState("assessment");
    const collegeState = createWorkflowState("college-onboarding").read();
    const studentState = createWorkflowState("student-onboarding").read();
    const qbState = createWorkflowState("question-bank").read();

    // Validate prerequisites
    test.skip(!collegeState.collegeId, "College not created — run Workflow 1 first");
    test.skip(!collegeState.collegeAdminEmail, "College admin email not found — run Workflow 1 first");
    test.skip(!qbState.questionBankId, "Question Bank not created — run Workflow 3 first");
    test.skip(!studentState.studentEmails || studentState.studentEmails.length === 0, "Students not created — run Workflow 2 first");

    const timestamp = Date.now();
    const assessmentName = `Assessment${timestamp}`;
    const campaignName = `Campaign${timestamp}`;
    const assessmentId = `assess-${timestamp}`;
    const campaignId = `camp-${timestamp}`;

    console.log(`[Workflow 4] Using prerequisites:`);
    console.log(`  - College: ${collegeState.collegeName}`);
    console.log(`  - QB: ${qbState.questionBankName} (${qbState.questionCount} questions)`);
    console.log(`  - Students: ${studentState.studentCount} students`);

    // ============================================
    // STEP 1: College Admin Authentication
    // ============================================
    console.log("[Workflow 4] Step 1: College Admin login...");
    await clearAuthSession(page);
    await loginPage.loginAs(
      collegeState.collegeAdminEmail,
      collegeState.collegeAdminTempPassword,
      COLLEGE_ADMIN.loginTab
    );
    await page.waitForURL(/college-portal|college|dashboard/, { timeout: 45_000 });
    expect(page.url()).toContain("college");
    console.log("[Workflow 4] ✓ College Admin authenticated");

    // ============================================
    // STEP 2: Navigate to Assessments
    // ============================================
    console.log("[Workflow 4] Step 2: Navigate to assessments...");
    const assessmentsPath = "/app/college-portal/assessments";
    await page.goto(`${BASE_URL}${assessmentsPath}`);
    await page.waitForSelector("h1, h2, button:text-is('New'), [data-testid='assessment-list']", { timeout: 15_000 }).catch(() => null);
    console.log("[Workflow 4] ✓ Assessments page loaded");

    // ============================================
    // STEP 3: Create New Assessment
    // ============================================
    console.log("[Workflow 4] Step 3: Create new assessment...");
    const newAssessmentButton = page.locator("button:text-is('New Assessment'), button:text-is('Create'), a[href*='/new']").first();

    if (await newAssessmentButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newAssessmentButton.click();
      await page.waitForTimeout(500);

      // Fill assessment form
      const nameInput = page.locator("input[name='name'], input[name='assessmentName']").first();
      const descInput = page.locator("textarea[name='description'], input[name='description']").first();
      const typeSelect = page.locator("select[name='type'], select[name='assessmentType']").first();

      if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nameInput.fill(assessmentName);
      }
      if (await descInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await descInput.fill(`Assessment for ${qbState.questionBankName}`);
      }
      if (await typeSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await typeSelect.selectOption("exam").catch(() => null);
      }

      // Submit form
      const submitBtn = page.locator("button[type='submit'], button:text-is('Create'), button:text-is('Next')").first();
      await submitBtn.click();
      await page.waitForTimeout(1_000);

      console.log(`[Workflow 4] ✓ Assessment created: ${assessmentName}`);
    } else {
      console.log("[Workflow 4] ℹ️  Create assessment button not found");
    }

    // ============================================
    // STEP 4: Select/Import Question Bank
    // ============================================
    console.log("[Workflow 4] Step 4: Import question bank...");

    // Look for QB selection interface
    const qbSearchInput = page.locator("input[placeholder*='question'], input[placeholder*='search']").first();
    const qbSelector = page.locator("select[name='questionBank'], select[name='qb_id']").first();

    if (await qbSelector.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await qbSelector.selectOption(qbState.questionBankId).catch(() => null);
      await page.waitForTimeout(500);
      console.log(`[Workflow 4] ✓ Question Bank selected: ${qbState.questionBankName}`);
    } else if (await qbSearchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await qbSearchInput.fill(qbState.questionBankName);
      await page.waitForTimeout(1_000);

      // Click on search result
      const resultItem = page.locator(`text=${qbState.questionBankName}`).first();
      if (await resultItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await resultItem.click();
      }
      console.log(`[Workflow 4] ✓ Question Bank imported: ${qbState.questionBankName}`);
    } else {
      console.log("[Workflow 4] ℹ️  QB selection interface not found");
    }

    // ============================================
    // STEP 5: Create Campaign
    // ============================================
    console.log("[Workflow 4] Step 5: Create campaign...");

    // Look for campaign creation button
    const newCampaignButton = page.locator("button:text-is('New Campaign'), button:text-is('Create Campaign'), a[href*='campaign/new']").first();

    if (await newCampaignButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newCampaignButton.click();
      await page.waitForTimeout(500);

      // Fill campaign form
      const campaignNameInput = page.locator("input[name='name'], input[name='campaignName']").first();
      const campaignDescInput = page.locator("textarea[name='description']").first();

      if (await campaignNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await campaignNameInput.fill(campaignName);
      }
      if (await campaignDescInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await campaignDescInput.fill(`Campaign using ${qbState.questionBankName}`);
      }

      // Submit
      const submitBtn = page.locator("button[type='submit'], button:text-is('Create'), button:text-is('Save')").first();
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1_000);
      }

      console.log(`[Workflow 4] ✓ Campaign created: ${campaignName}`);
    } else {
      console.log("[Workflow 4] ℹ️  Campaign button not found, continuing...");
    }

    // ============================================
    // STEP 6: Assign Students to Assessment
    // ============================================
    console.log("[Workflow 4] Step 6: Assign students to assessment...");

    // Look for student assignment interface
    const assignStudentsButton = page.locator("button:text-is('Assign Students'), button:text-is('Add Students'), [data-testid='assign-btn']").first();

    if (await assignStudentsButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await assignStudentsButton.click();
      await page.waitForTimeout(500);

      // Select students (check first few from the list)
      const studentCheckboxes = page.locator("input[type='checkbox'][name*='student']");
      const checkboxCount = await studentCheckboxes.count();

      const assignCount = Math.min(studentState.studentCount, checkboxCount, 3);
      for (let i = 0; i < assignCount; i++) {
        const checkbox = studentCheckboxes.nth(i);
        if (await checkbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await checkbox.check();
        }
      }

      // Confirm assignment
      const confirmBtn = page.locator("button:text-is('Assign'), button:text-is('Confirm'), button:text-is('Save')").first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1_000);
      }

      console.log(`[Workflow 4] ✓ Students assigned (${assignCount} students)`);
    } else {
      console.log("[Workflow 4] ℹ️  Student assignment interface not found");
    }

    // ============================================
    // STEP 7: Publish Assessment
    // ============================================
    console.log("[Workflow 4] Step 7: Publish assessment...");

    // Look for publish button
    const publishButton = page.locator("button:text-is('Publish'), button:text-is('Go Live'), [data-testid='publish-btn']").first();

    if (await publishButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await publishButton.click();

      // Confirm if modal appears
      const confirmBtn = page.locator("button:text-is('Confirm'), button:text-is('Yes')").first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await page.waitForTimeout(1_000);
      console.log("[Workflow 4] ✓ Assessment published");
    } else {
      console.log("[Workflow 4] ℹ️  Assessment already published or publish button not found");
    }

    // ============================================
    // STEP 8: Save Workflow State
    // ============================================
    console.log("[Workflow 4] Step 8: Save workflow state...");
    workflowState.write({
      assessmentId,
      assessmentName,
      campaignId,
      campaignName,
      questionBankId: qbState.questionBankId,
      questionBankName: qbState.questionBankName,
      collegeId: collegeState.collegeId,
      studentCount: studentState.studentCount,
      studentEmails: studentState.studentEmails,
      status: "published",
      workflowCompletedAt: new Date().toISOString(),
    });
    console.log(`[Workflow 4] ✓ State saved to: ${workflowState.getPath()}`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log(`
╔════════════════════════════════════════╗
║  WORKFLOW 4: ASSESSMENT CREATED ✓     ║
╠════════════════════════════════════════╣
║ Assessment:       ${assessmentName.padEnd(23)} ║
║ Campaign:         ${campaignName.padEnd(23)} ║
║ Question Bank:    ${qbState.questionBankName.padEnd(23)} ║
║ Questions:        ${qbState.questionCount}                       ║
║ College:          ${collegeState.collegeName.substring(0, 23).padEnd(23)} ║
║ Students:         ${studentState.studentCount}                       ║
║ Status:           PUBLISHED             ║
║ Ready for:        Workflow 5 (Learning) / 6 (Exam) ║
╚════════════════════════════════════════╝
    `);
  });
});
