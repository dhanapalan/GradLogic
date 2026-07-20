/**
 * FLOW 12 — Campus Admin (staff) management
 * CampusAdminsPage.tsx is the real routed page; CollegeAdminsPage.tsx is a
 * dead/unrouted dummy-data page and is intentionally not tested.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, STRONG_PASSWORD, ROUTES } from "../config/env";
import { buildCollege } from "../data/factories";
import { writeState, readState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

function stamp(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test.describe("FLOW 12 — Campus Admin Management", () => {
  test("12.0 Setup: create a college and log in as its admin", async ({
    loginPage,
    collegeCreate,
    passwordSetupPage,
    page,
  }) => {
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    const college = buildCollege();
    await page.goto(ROUTES.collegesNew);
    const creds = await collegeCreate.create(college);
    await collegeCreate.done();

    await loginPage.loginAs(creds.tpoEmail, creds.temporaryPassword, "College Admin");
    if (page.url().includes("/auth/setup-password")) {
      await passwordSetupPage.expectForcedReset();
      await passwordSetupPage.setStrongPassword(STRONG_PASSWORD);
    }
    if (page.url().includes("/auth/login")) {
      await loginPage.loginAs(creds.tpoEmail, STRONG_PASSWORD, "College Admin");
    }
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    writeState({ adminMgmtCollegeAdminEmail: creds.tpoEmail, adminMgmtCollegeAdminPassword: STRONG_PASSWORD });
  });

  test("12.1 Add a staff member, verify listed, then remove", async ({
    loginPage,
    campusAdminsPage,
    page,
  }) => {
    const state = readState();
    test.skip(!state.adminMgmtCollegeAdminEmail, "Requires 12.0 setup state");

    await loginPage.loginAs(
      state.adminMgmtCollegeAdminEmail!,
      state.adminMgmtCollegeAdminPassword!,
      "College Admin"
    );
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    await page.goto(ROUTES.campusAdmins);
    await campusAdminsPage.expectLoaded();

    const id = stamp();
    const name = `QA Staff ${id.slice(-6)}`;
    const email = `qa.staff.${id}@example.edu`;
    await campusAdminsPage.addStaff(name, email, "StaffPass123");
    await expect(campusAdminsPage.rowFor(name)).toBeVisible();
    expect((await campusAdminsPage.statusFor(name)).toLowerCase()).toBe("active");

    // "Remove" is a soft-delete — the row stays but flips to Inactive.
    await campusAdminsPage.removeStaff(name);
    expect((await campusAdminsPage.statusFor(name)).toLowerCase()).toBe("inactive");
  });

  test("12.2 Duplicate staff email → error toast, member not duplicated", async ({
    loginPage,
    campusAdminsPage,
    page,
  }) => {
    const state = readState();
    test.skip(!state.adminMgmtCollegeAdminEmail, "Requires 12.0 setup state");

    await loginPage.loginAs(
      state.adminMgmtCollegeAdminEmail!,
      state.adminMgmtCollegeAdminPassword!,
      "College Admin"
    );
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    await page.goto(ROUTES.campusAdmins);
    await campusAdminsPage.expectLoaded();

    const id = stamp();
    const name = `QA Dup Staff ${id.slice(-6)}`;
    const email = `qa.dupstaff.${id}@example.edu`;
    await campusAdminsPage.addStaff(name, email, "StaffPass123");
    await expect(campusAdminsPage.rowFor(name)).toBeVisible();

    // Same email again — expect a rejection toast, not a second row.
    await campusAdminsPage.click(campusAdminsPage.addStaffMember);
    await campusAdminsPage.type(campusAdminsPage.nameInput, `${name} Duplicate`);
    await campusAdminsPage.type(campusAdminsPage.emailInput, email);
    await campusAdminsPage.type(campusAdminsPage.passwordInput, "StaffPass123");
    await campusAdminsPage.click(campusAdminsPage.addMember);
    await expect(
      page.locator("[role='status'], [class*='toast']").filter({ hasText: /already exists|failed|email/i })
    ).toBeVisible({ timeout: 15_000 });

    // The add-staff modal only closes on success — it's still open after this
    // rejection, and would otherwise block the table underneath from clicks.
    await campusAdminsPage.click(campusAdminsPage.closeModal);

    await expect(campusAdminsPage.rowFor(`${name} Duplicate`)).toHaveCount(0);
    await campusAdminsPage.removeStaff(name);
  });
});
