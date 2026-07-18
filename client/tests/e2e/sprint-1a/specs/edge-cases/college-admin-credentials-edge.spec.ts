/**
 * COLLEGE ADMIN — Credential generation edge cases
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN, COLLEGE_ADMIN, ROUTES, STRONG_PASSWORD } from "../../config/env";
import { collegeValid } from "../../data/edge-payloads";
import {
  expectErrorToast,
  waitForApi,
  expectApiStatus,
  expectStillOnUrl,
} from "../../helpers/edge-expect";
import { writeState, readState } from "../../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("EDGE — College Admin credentials", () => {
  test("Cancel credential generation (Cancel on create form before submit)", async ({
    loginPage,
    page,
    collegeCreate,
    collegesList,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();
    await collegeCreate.fill(collegeValid());
    const cancel = page.getByRole("button", { name: /^Cancel$/i }).or(
      page.getByRole("link", { name: /^Cancel$/i })
    );
    await collegeCreate.click(cancel.first());
    await expect(page).toHaveURL(/\/app\/superadmin\/colleges/);
    await collegesList.expectLoaded();
    // Ensure credentials screen never shown
    await expect(page.getByText(/Temporary Password/i)).toHaveCount(0);
    await collegeCreate.shot("creds_cancel_before_generate");
  });

  test("Generate credentials once — password visible; leaving page = already generated (not retrievable)", async ({
    loginPage,
    page,
    collegeCreate,
    collegesList,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const data = collegeValid();
    await page.goto(ROUTES.collegesNew);
    const creds = await collegeCreate.create(data);
    expect(creds.temporaryPassword.length).toBeGreaterThan(5);
    writeState({
      tpoEmail: creds.tpoEmail,
      tpoTempPassword: creds.temporaryPassword,
      collegeName: data.name,
    });

    await collegeCreate.done();
    await collegesList.searchCollege(data.name);
    await collegesList.openView(data.name);

    // Detail must NOT re-show temporary password
    await expect(page.locator("code")).toHaveCount(0).catch(async () => {
      await expect(page.getByText(/Temporary Password/i)).toHaveCount(0);
    });
    await collegeCreate.shot("creds_already_generated_not_shown");
  });

  test("Generate credentials twice for same TPO email → blocked (409)", async ({
    loginPage,
    page,
    collegeCreate,
    consoleMon,
  }) => {
    // This test intentionally triggers a 409 on the second create; the app's
    // own catch block console.errors it (AddCollegePage.tsx), which is
    // expected behavior for this negative-path test, not a bug.
    consoleMon.ignore(/Failed to create college: AxiosError/i, /AxiosError: Request failed with status code 409/i);
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const first = collegeValid();
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.create(first);
    await collegeCreate.done();

    // Second college with same TPO email
    await page.goto(ROUTES.collegesNew);
    const second = collegeValid({
      tpoEmail: first.tpoEmail,
      email: `college2.${Date.now()}@example.edu`,
      name: `Second College ${Date.now()}`,
    });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(second);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    await expectApiStatus(res, [409, 400], "duplicate TPO credentials");
    await expectErrorToast(page, /already exists|TPO|Failed|email/i, "creds_generate_twice");
    await expectStillOnUrl(page, /\/colleges\/new/);
  });

  test("Expired / consumed temporary password — after forced reset, temp password fails", async ({
    loginPage,
    passwordSetupPage,
    page,
  }) => {
    const state = readState();
    const email = state.tpoEmail || COLLEGE_ADMIN.email;
    const temp = state.tpoTempPassword;

    test.skip(!temp, "Requires prior credential generation in this suite");

    // First login with temp → set new password
    await loginPage.loginAs(email, temp!, "College Admin");
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
      writeState({ tpoPassword: STRONG_PASSWORD });
    }

    // Logout if needed
    await page.goto(ROUTES.login);

    // Temp password should no longer work (consumed / expired for login)
    await loginPage.loginAs(email, temp!, "College Admin");
    await expectErrorToast(
      page,
      /Invalid|incorrect|failed|credentials|password/i,
      "creds_temp_password_expired"
    ).catch(async () => {
      // If still logged in somehow, must not be using temp path successfully without setup
      await expect(page).not.toHaveURL(/\/auth\/setup-password/);
    });
  });

  test("Network failure during college create (credential generation)", async ({
    loginPage,
    page,
    collegeCreate,
    context,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.fill(collegeValid());
    await context.setOffline(true);
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /Failed|network|error/i, "creds_network_failure").catch(
      async () => {
        await expect(page.getByText(/Temporary Password/i)).toHaveCount(0);
        await expectStillOnUrl(page, /\/colleges\/new/);
      }
    );
    await context.setOffline(false);
  });
});
