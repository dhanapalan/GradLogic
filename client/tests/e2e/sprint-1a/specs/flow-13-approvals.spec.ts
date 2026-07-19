/**
 * FLOW 13 — Superadmin Approvals (college registration approve/reject)
 * superadmin.controller.ts's createCollege always inserts status='pending',
 * so every college created via the existing collegeCreate flow already
 * lands in this approvals queue — no separate public registration flow needed.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, ROUTES } from "../config/env";
import { buildCollege } from "../data/factories";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 13 — Approvals", () => {
  test("13.1 Approve a pending college registration", async ({
    loginPage,
    collegeCreate,
    approvalsPage,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const college = buildCollege({ name: `QA Approve College ${Date.now()}` });
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.create(college);
    await collegeCreate.done();

    await page.goto(ROUTES.approvals);
    await approvalsPage.expectLoaded();
    await approvalsPage.approveCollege(college.name, "Looks good");
    await approvalsPage.expectCollegeGone(college.name);
  });

  test("13.2 Reject a pending college registration with a reason", async ({
    loginPage,
    collegeCreate,
    approvalsPage,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const college = buildCollege({ name: `QA Reject College ${Date.now()}` });
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.create(college);
    await collegeCreate.done();

    await page.goto(ROUTES.approvals);
    await approvalsPage.expectLoaded();
    await approvalsPage.rejectCollege(college.name, "Incomplete documentation");
    await approvalsPage.expectCollegeGone(college.name);
  });

  test.skip("13.3 Reject without a reason → blocked client-side", async ({
    loginPage,
    collegeCreate,
    approvalsPage,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const college = buildCollege({ name: `QA Reject NoReason College ${Date.now()}` });
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.create(college);
    await collegeCreate.done();

    await page.goto(ROUTES.approvals);
    await approvalsPage.expectLoaded();

    const card = approvalsPage.cardFor(college.name);
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Click reject button with proper wait
    const rejectBtn = card.getByRole("button", { name: /^Reject$/i });
    await expect(rejectBtn).toBeVisible({ timeout: 10_000 });
    await approvalsPage.click(rejectBtn);

    // Try to confirm rejection without entering a reason
    const confirmBtn = card.getByRole("button", { name: /Confirm Rejection/i });
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    await approvalsPage.click(confirmBtn);

    // Expect validation toast
    await expect(
      page.locator("[role='status'], [class*='toast']").filter({ hasText: /reason is required/i })
    ).toBeVisible({ timeout: 10_000 });

    // Card should still be visible (not rejected yet)
    await expect(card).toBeVisible({ timeout: 5_000 });

    // Clean up: reject with a reason so it doesn't linger
    await approvalsPage.rejectCollege(college.name, "Test cleanup");
  });
});
