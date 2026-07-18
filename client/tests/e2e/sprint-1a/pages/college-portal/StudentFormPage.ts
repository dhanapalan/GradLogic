import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import type { StudentPayload } from "../../data/factories";
import { expectToast } from "../../utils/assertions";

export type StudentCredentials = {
  email: string;
  temporaryPassword?: string;
  studentId?: string;
};

export class StudentFormPage extends BasePage {
  readonly path = ROUTES.campusStudentNew;
  readonly heading = /Add Student/i;

  /** Prefer label-associated inputs from StudentFormPage Field components. */
  byLabel(label: string | RegExp) {
    return this.page.getByLabel(label);
  }

  get submit() {
    return this.page.getByRole("button", { name: /^Add$/i });
  }

  async expectForm(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/students\/new/,
      heading: /Add Student/i,
      screenshot: "student_registration_form",
      allowConsoleNoise: true,
    });
  }

  async fill(data: StudentPayload): Promise<void> {
    await this.type(this.byLabel(/Roll Number/i), data.roll_number);
    await this.type(this.byLabel(/Student Name/i), data.name);
    await this.type(this.byLabel(/^Email/i), data.email);
    if (data.mobile) {
      const mobile = this.byLabel(/Mobile/i);
      if (await mobile.count()) await this.type(mobile, data.mobile);
    }
    const dept = this.byLabel(/Department/i);
    if (await dept.count()) await this.type(dept, data.department);
    const batch = this.byLabel(/Batch/i);
    if (await batch.count()) await this.type(batch, data.batch);
    await this.shot("student_registration_filled");
  }

  async register(data: StudentPayload): Promise<StudentCredentials> {
    await this.fill(data);
    const responsePromise = this.page.waitForResponse(
      (r) =>
        (r.url().includes("/campus/students") || r.url().includes("/students")) &&
        r.request().method() === "POST",
      { timeout: 45_000 }
    );
    await this.click(this.submit);
    const res = await responsePromise;
    expect(res.ok()).toBeTruthy();

    let temporaryPassword: string | undefined;
    try {
      const body = await res.json();
      temporaryPassword =
        body?.data?.temporary_password ||
        body?.temporary_password ||
        undefined;
    } catch {
      /* ignore */
    }

    await expectToast(this.page, /success|created|added|temporary/i);
    await this.shot("student_registration_success");

    return {
      email: data.email,
      temporaryPassword,
      studentId: this.page.url().match(/students\/([^/]+)/)?.[1],
    };
  }
}
