/**
 * FLOW 2 — College CRUD
 * Create → Edit → Deactivate (cancel + confirm) → Activate → Grid → Details
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, ROUTES } from "../config/env";
import { buildCollege } from "../data/factories";
import { writeState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 2 — College CRUD", () => {
  const college = buildCollege();
  let createdName = college.name;

  test.beforeEach(async ({ loginPage, page }) => {
    if (page.url().includes("/superadmin")) return;
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });
  });

  test("2.1 Create College and verify success + credentials screen", async ({
    page,
    collegesList,
    collegeCreate,
  }) => {
    await page.goto(ROUTES.colleges);
    await collegesList.expectLoaded();
    await collegesList.openCreate();
    await collegeCreate.expectForm();

    const creds = await collegeCreate.create(college);
    createdName = college.name;
    writeState({
      collegeName: college.name,
      tpoEmail: creds.tpoEmail,
      tpoTempPassword: creds.temporaryPassword,
    });

    await collegeCreate.expectCredentials(creds);
    await collegeCreate.copyPassword();
    await collegeCreate.done();
    await collegesList.expectLoaded();
    await collegesList.searchCollege(college.name);
    await expect(collegesList.rowFor(college.name)).toBeVisible();
  });

  test("2.2 Edit College and verify update", async ({ page, collegesList, collegeDetail }) => {
    await page.goto(ROUTES.colleges);
    await collegesList.searchCollege(createdName);
    await collegesList.openView(createdName);
    await collegeDetail.expectDetails(createdName);
    await collegeDetail.editCity(`QACity-${Date.now().toString().slice(-4)}`);
  });

  test("2.3 Deactivate — cancel leaves status unchanged; confirm suspends", async ({
    page,
    collegesList,
    confirmModal,
  }) => {
    await page.goto(ROUTES.colleges);
    await collegesList.searchCollege(createdName);
    await collegesList.suspendWithCancelThenConfirm(createdName, confirmModal);
  });

  test("2.4 Activate College and verify Active + grid/details", async ({
    page,
    collegesList,
    collegeDetail,
    confirmModal,
  }) => {
    await page.goto(ROUTES.colleges);
    await collegesList.searchCollege(createdName);
    await collegesList.activate(createdName, confirmModal);
    await collegesList.openView(createdName);
    await collegeDetail.expectDetails(createdName);
  });
});
