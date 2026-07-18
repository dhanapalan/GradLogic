import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";

export class StudentsListPage extends BasePage {
  readonly path = ROUTES.campusStudents;
  readonly heading = /^Students$/i;

  get search() {
    return this.page.getByPlaceholder(/Search name, email, roll/i);
  }
  get addStudent() {
    return this.page.getByRole("link", { name: /Add Student/i }).or(
      this.page.getByRole("button", { name: /Add Student/i })
    );
  }

  async expectLoaded(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/college-portal\/students/,
      heading: /Students/i,
      screenshot: "campus_students_list",
      allowConsoleNoise: true,
    });
  }

  async openCreate(): Promise<void> {
    await this.click(this.addStudent.first());
    await expect(this.page).toHaveURL(/\/students\/new/);
  }

  async expectStudentExists(identifier: string): Promise<void> {
    if (await this.search.count()) {
      await this.type(this.search, identifier);
      await this.page.waitForTimeout(400);
    }
    await expect(this.page.getByText(identifier).first()).toBeVisible();
    await this.shot("student_exists_in_grid");
  }
}
