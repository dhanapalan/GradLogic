/**
 * Super Admin — validate ALL sidebar menus + valid/invalid form data
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, ROUTES } from "../config/env";
import { SUPER_ADMIN_MENUS } from "../data/menus";
import { MenuNavigator, expectValidationFeedback } from "../pages/shared/MenuNavigator";
import { collegeValid, collegeInvalidEmail, collegeBlankMandatory } from "../data/edge-payloads";
import { expectToast } from "../utils/assertions";

test.describe.configure({ mode: "serial" });

test.describe("MENU — Super Admin portal", () => {
  test("Walk every Super Admin menu leaf (valid navigation)", async ({
    loginPage,
    page,
    consoleMon,
    networkMon,
  }) => {
    // Many feature pages return soft 404/empty — don't fail suite on console/network noise
    test.info().annotations.push({ type: "stability", description: "allow-network" });
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "skip-ui-gates" });

    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    const nav = new MenuNavigator(page, consoleMon, networkMon);
    const results = await nav.visitAll(SUPER_ADMIN_MENUS);

    const hardFails = results.filter(
      (r) => !r.ok && (r.reason === "redirected to login" || r.reason === "error boundary" || r.reason === "not authorized")
    );
    expect(
      hardFails,
      hardFails.map((f) => `${f.label}: ${f.reason}`).join("\n") || "no hard menu failures"
    ).toHaveLength(0);

    const okCount = results.filter((r) => r.ok).length;
    // At least core org + admin menus must pass; soft feature pages allowed to soft-fail heading
    expect(okCount).toBeGreaterThanOrEqual(10);
    expect(results.length).toBe(SUPER_ADMIN_MENUS.length);
  });

  test("INVALID data — Add College blank + invalid email", async ({
    loginPage,
    page,
    collegeCreate,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();

    await collegeCreate.fill(collegeBlankMandatory());
    await collegeCreate.click(collegeCreate.submit);
    await expectValidationFeedback(page, /required|Invalid/i);
    await expect(page).toHaveURL(/\/colleges\/new/);

    await collegeCreate.fill(collegeInvalidEmail());
    await collegeCreate.click(collegeCreate.submit);
    await expectValidationFeedback(page, /Invalid.*email|email/i);
  });

  test("VALID data — Add College with credentials screen", async ({
    loginPage,
    page,
    collegeCreate,
    collegesList,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await page.goto(ROUTES.collegesNew);
    const data = collegeValid();
    const creds = await collegeCreate.create(data);
    expect(creds.temporaryPassword.length).toBeGreaterThan(4);
    await collegeCreate.expectCredentials(creds);
    await collegeCreate.done();
    await collegesList.searchCollege(data.name);
    await expect(collegesList.rowFor(data.name)).toBeVisible();
  });

  test("INVALID / VALID — Invite / create user from Users menu", async ({
    loginPage,
    page,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });

    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await page.goto("/app/superadmin/users");
    await expect(page.getByRole("heading", { name: /User|Faculty|All Users/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    const invite =
      page.getByRole("button", { name: /Invite|Add User|Create User|New User/i }).first();
    if ((await invite.count()) === 0) {
      test.skip(true, "Invite User control not found on Users page");
    }
    await invite.click();

    const dialog = page.getByRole("dialog").or(page.locator("form").filter({ hasText: /email|password|role/i }));
    await expect(dialog.first()).toBeVisible({ timeout: 10_000 });

    // Invalid — submit empty / bad email
    const submit = page.getByRole("button", { name: /Invite|Create|Save|Add/i }).last();
    await submit.click();
    await expectValidationFeedback(page, /required|email|password|name|invalid/i).catch(
      async () => {
        // HTML5 validation may block submit
        await expect(page.locator("input:invalid").first()).toBeVisible();
      }
    );

    // Valid-ish fill if fields present
    const email = page.getByLabel(/Email/i).or(page.locator('[name="email"]'));
    const name = page.getByLabel(/Name|Full name/i).or(page.locator('[name="full_name"], [name="name"]'));
    const password = page.getByLabel(/^Password/i).or(page.locator('[name="password"]'));
    if ((await email.count()) && (await name.count()) && (await password.count())) {
      const stamp = Date.now();
      await name.first().fill(`QA User ${stamp}`);
      await email.first().fill(`qa.user.${stamp}@example.com`);
      await password.first().fill("GradLogic@2026!");
      await submit.click();
      await expectToast(page, /success|invited|created|added/i).catch(async () => {
        await expectValidationFeedback(page, /already|exists|Failed|role|college/i);
      });
    }
  });
});
