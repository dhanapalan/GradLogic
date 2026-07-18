/**
 * FLOW 6 — Student Registration (College Admin)
 * Register student → Success → Verify exists in grid
 */
import { test, expect } from "../fixtures/test.fixture";
import { COLLEGE_ADMIN, ROUTES } from "../config/env";
import { buildStudent } from "../data/factories";
import { readState, writeState } from "../helpers/runtime-state";

test.describe.configure({ mode: "serial" });

test.describe("FLOW 6 — Student Registration", () => {
  test("6.1 Register student and verify success + list presence", async ({
    loginPage,
    studentsList,
    studentForm,
    page,
  }) => {
    const state = readState();
    const email = state.tpoEmail || COLLEGE_ADMIN.email;
    const password = state.tpoPassword || COLLEGE_ADMIN.password;

    await loginPage.loginAs(email, password, "College Admin");
    await expect(page).toHaveURL(/\/app\/college-portal/, { timeout: 45_000 });

    await page.goto(ROUTES.campusStudentNew);
    await studentForm.expectForm();

    const student = buildStudent();
    const created = await studentForm.register(student);

    writeState({
      studentEmail: created.email,
      studentTempPassword: created.temporaryPassword,
      studentRoll: student.roll_number,
    });

    await page.goto(ROUTES.campusStudents);
    await studentsList.expectLoaded();
    await studentsList.expectStudentExists(student.roll_number);
  });
});
