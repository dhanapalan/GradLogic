/**
 * FLOW 3 — College Admin Credential Generation
 * Covered primarily on the post-create credentials screen (also exercised in Flow 2).
 * This flow re-asserts username, temp password, email, success message, and copy.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, ROUTES } from "../config/env";
import { buildCollege } from "../data/factories";
import { writeState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 3 — College Admin Credential Generation", () => {
  test("3.1 Generate credentials and verify username, password, email, copy", async ({
    loginPage,
    page,
    collegesList,
    collegeCreate,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    const college = buildCollege({ name: `QA Creds College ${Date.now()}` });
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();
    const creds = await collegeCreate.create(college);

    expect(creds.tpoEmail).toBe(college.tpoEmail);
    expect(creds.temporaryPassword.length).toBeGreaterThan(5);

    await collegeCreate.expectCredentials(creds);
    await expect(page.getByText(/College added successfully|College created|Save the TPO/i).first()).toBeVisible();
    await collegeCreate.copyPassword();

    writeState({
      collegeName: college.name,
      tpoEmail: creds.tpoEmail,
      tpoTempPassword: creds.temporaryPassword,
    });

    await collegeCreate.done();
    await collegesList.expectLoaded();
  });
});
