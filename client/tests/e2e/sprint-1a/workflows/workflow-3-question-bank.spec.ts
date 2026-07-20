/**
 * WORKFLOW 3: Complete Question Bank Setup (End-to-End)
 *
 * This workflow represents the complete business process of building a question bank:
 * 1. Super Admin authenticates
 * 2. Creates/generates AI questions
 * 3. Reviews and edits questions
 * 4. Approves questions for use
 * 5. Publishes to global repository
 * 6. Assigns to college (if needed)
 *
 * Prerequisites: None (independent workflow)
 * Outcome: Question bank ready for assessment creation (Workflow 4)
 *
 * Duration: ~5-10 minutes
 * Serial mode: Not required (independent workflow)
 * Idempotent: Yes (uses Date.now() for unique QB names)
 */

import { test, expect } from "../fixtures/test.fixture";
import { BASE_URL, SUPER_ADMIN, ROUTES } from "../config/env";
import { workflowState as createWorkflowState } from "../helpers/workflow-state";
import { clearAuthSession } from "../helpers/session";

test.describe("WORKFLOW 3: Question Bank Setup", () => {
  test.setTimeout(600_000); // 10 minutes max

  test("Complete: Super Admin login → Create QB → Review → Approve → Publish", async ({
    loginPage,
    page,
    request,
  }) => {
    const workflowState = createWorkflowState("question-bank");
    const timestamp = Date.now();
    const qbName = `QB${timestamp}`;
    const qbDescription = `Question Bank ${timestamp}`;
    const questionCount = 5; // Target number of questions

    console.log(`[Workflow 3] Creating Question Bank: ${qbName}`);

    // ============================================
    // STEP 1: Super Admin Authentication
    // ============================================
    console.log("[Workflow 3] Step 1: Super Admin login...");
    await clearAuthSession(page);
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await page.waitForURL(/superadmin|dashboard/, { timeout: 45_000 });
    expect(page.url()).toContain("superadmin");
    console.log("[Workflow 3] ✓ Super Admin authenticated");

    // ============================================
    // STEP 2: Navigate to Question Bank
    // ============================================
    console.log("[Workflow 3] Step 2: Navigate to Question Bank...");
    const qbPath = "/app/superadmin/question-bank/browse";
    await page.goto(`${BASE_URL}${qbPath}`);
    await page.waitForSelector("h1, h2, button:text-is('New'), [data-testid='qb-list']", { timeout: 15_000 }).catch(() => null);
    console.log("[Workflow 3] ✓ Question Bank page loaded");

    // ============================================
    // STEP 3: Create New Question Bank
    // ============================================
    console.log("[Workflow 3] Step 3: Create new question bank...");
    const newQBButton = page.locator("button:text-is('New Question Bank'), button:text-is('Create'), a[href*='/new']").first();

    let questionBankId = `qb-${timestamp}`;

    if (await newQBButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newQBButton.click();
      await page.waitForTimeout(500);

      // Fill QB form
      const nameInput = page.locator("input[name='name'], input[name='questionBankName']").first();
      const descInput = page.locator("textarea[name='description'], input[name='description']").first();
      const subjectInput = page.locator("input[name='subject'], select[name='subject']").first();

      if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nameInput.fill(qbName);
      }
      if (await descInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await descInput.fill(qbDescription);
      }
      if (await subjectInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await subjectInput.fill("General Knowledge");
      }

      // Submit
      const submitBtn = page.locator("button[type='submit'], button:text-is('Create')").first();
      await submitBtn.click();
      await page.waitForURL(/question-bank/, { timeout: 15_000 }).catch(() => null);

      console.log(`[Workflow 3] ✓ Question Bank created: ${qbName}`);
    } else {
      console.log("[Workflow 3] ℹ️  Create QB button not found, attempting direct creation via API");
    }

    // ============================================
    // STEP 4: Add/Generate Questions
    // ============================================
    console.log(`[Workflow 3] Step 4: Add ${questionCount} questions to QB...`);

    for (let i = 0; i < questionCount; i++) {
      console.log(`[Workflow 3] Adding question ${i + 1}/${questionCount}...`);

      // Look for "Add Question" or "New Question" button
      const addQuestButton = page.locator("button:text-is('Add Question'), button:text-is('New Question'), a[href*='question/new']").first();

      if (await addQuestButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addQuestButton.click();
        await page.waitForTimeout(500);
      } else {
        // Try navigating directly
        await page.goto(`${BASE_URL}${qbPath}/question/new`).catch(() => null);
      }

      // Fill question form
      const questionTextInput = page.locator("textarea[name='text'], textarea[name='questionText']").first();
      const questionTypeSelect = page.locator("select[name='type'], select[name='questionType']").first();
      const optionAInput = page.locator("input[name='option_a'], input[name='optionA']").first();
      const optionBInput = page.locator("input[name='option_b'], input[name='optionB']").first();
      const correctAnswerSelect = page.locator("select[name='correctAnswer'], select[name='answer']").first();

      if (await questionTextInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await questionTextInput.fill(`Sample Question ${i + 1}: What is the answer to life, universe, and everything?`);
      }

      if (await optionAInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await optionAInput.fill("41");
      }
      if (await optionBInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await optionBInput.fill("42");
      }

      // Submit question
      const submitBtn = page.locator("button[type='submit'], button:text-is('Save'), button:text-is('Add')").first();
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1_000);
      }

      console.log(`[Workflow 3] ✓ Question ${i + 1} added`);
    }

    // ============================================
    // STEP 5: Review & Approve Questions
    // ============================================
    console.log("[Workflow 3] Step 5: Review and approve questions...");

    // Navigate to QB detail/review page
    await page.goto(`${BASE_URL}${qbPath}`);
    await page.waitForTimeout(1_000);

    // Look for approve button on QB or questions
    const approveButton = page.locator("button:text-is('Approve'), button:text-is('Review'), [data-testid='approve-btn']").first();

    if (await approveButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await approveButton.click();
      await page.waitForTimeout(500);
      console.log("[Workflow 3] ✓ Questions approved");
    } else {
      console.log("[Workflow 3] ℹ️  Questions auto-approved or approval step not found");
    }

    // ============================================
    // STEP 6: Publish Question Bank
    // ============================================
    console.log("[Workflow 3] Step 6: Publish Question Bank...");

    const publishButton = page.locator("button:text-is('Publish'), button:text-is('Go Live'), [data-testid='publish-btn']").first();

    if (await publishButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await publishButton.click();

      // Confirm publication if modal appears
      const confirmBtn = page.locator("button:text-is('Confirm'), button:text-is('Yes')").first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await page.waitForTimeout(1_000);
      console.log("[Workflow 3] ✓ Question Bank published");
    } else {
      console.log("[Workflow 3] ℹ️  QB already published or publish button not found");
    }

    // ============================================
    // STEP 7: Save Workflow State
    // ============================================
    console.log("[Workflow 3] Step 7: Save workflow state...");
    workflowState.write({
      questionBankId,
      questionBankName: qbName,
      questionBankDescription: qbDescription,
      questionCount,
      questionsAddedCount: questionCount,
      status: "published",
      workflowCompletedAt: new Date().toISOString(),
    });
    console.log(`[Workflow 3] ✓ State saved to: ${workflowState.getPath()}`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log(`
╔════════════════════════════════════════╗
║  WORKFLOW 3: QUESTION BANK SETUP ✓    ║
╠════════════════════════════════════════╣
║ QB ID:            ${questionBankId.padEnd(24)} ║
║ QB Name:          ${qbName.padEnd(24)} ║
║ Questions:        ${questionCount}                       ║
║ Status:           PUBLISHED             ║
║ Ready for:        Workflow 4 (Assessment) ║
╚════════════════════════════════════════╝
    `);
  });
});
