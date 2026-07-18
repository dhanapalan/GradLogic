import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import type { CollegePayload } from "../../data/factories";
import { expectToast } from "../../utils/assertions";

export type GeneratedCredentials = {
  collegeName: string;
  tpoEmail: string;
  temporaryPassword: string;
};

export class CollegeCreatePage extends BasePage {
  readonly path = ROUTES.collegesNew;
  readonly heading = /Add New College|College created/i;

  field(name: string) {
    return this.page.locator(`[name="${name}"]`);
  }

  get submit() {
    return this.page.getByRole("button", { name: /Create College/i });
  }

  async expectForm(): Promise<void> {
    await this.waitLoaded();
    await this.validate({
      urlIncludes: /\/colleges\/new/,
      heading: /Add New College/i,
      requiredControls: [
        this.field("name"),
        this.field("email"),
        this.field("tpoEmail"),
        this.submit,
      ],
      screenshot: "college_create_form",
      allowConsoleNoise: true,
    });
  }

  /**
   * The form's inputs carry native HTML5 `required` attributes. When every
   * field is genuinely empty, the browser's own constraint-validation blocks
   * submission before React's onSubmit/validateForm() ever runs, so the
   * app's own validation toast never fires. Tests that intentionally submit
   * a fully-blank form (to exercise the app's own validation messaging, not
   * the browser's) should call this first.
   */
  async disableNativeValidation(): Promise<void> {
    await this.page.evaluate(() => {
      document.querySelectorAll("form").forEach((f) => (f.noValidate = true));
    });
  }

  async fill(data: CollegePayload): Promise<void> {
    await this.type(this.field("name"), data.name);
    await this.type(this.field("email"), data.email);
    await this.type(this.field("phone"), data.phone);
    await this.type(this.field("address"), data.address);
    await this.type(this.field("city"), data.city);
    await this.type(this.field("state"), data.state);
    await this.type(this.field("tpoName"), data.tpoName);
    await this.type(this.field("tpoEmail"), data.tpoEmail);
    await this.field("studentLimit").fill(String(data.studentLimit));
    await this.shot("college_create_filled");
  }

  async create(data: CollegePayload): Promise<GeneratedCredentials> {
    await this.lifecycle("before-save", "create-college");
    await this.fill(data);
    await this.click(this.submit);

    await this.page.waitForResponse(
      (r) =>
        r.url().includes("/superadmin/colleges") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 45_000 }
    );

    await expectToast(this.page, /College added successfully/i);
    await expect(this.page.getByRole("heading", { name: /College created/i })).toBeVisible();

    const tempPwd = (
      await this.page.locator("code").first().innerText()
    ).trim();
    const emailText = await this.page.getByText(data.tpoEmail).first().innerText();

    await this.lifecycle("after-save", "create-college");
    await this.shot("college_credentials_generated");

    return {
      collegeName: data.name,
      tpoEmail: data.tpoEmail,
      temporaryPassword: tempPwd || emailText,
    };
  }

  async expectCredentials(creds: GeneratedCredentials): Promise<void> {
    await expect(this.page.getByText(/Temporary Password/i)).toBeVisible();
    await expect(this.page.getByText(creds.tpoEmail)).toBeVisible();
    await expect(this.page.locator("code").first()).toBeVisible();
    await expect(this.page.getByText(creds.collegeName)).toBeVisible();
    await this.shot("college_credentials_verified");
  }

  async copyPassword(): Promise<void> {
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await this.click(this.page.locator("[title='Copy password']").or(this.page.getByRole("button", { name: /Copy/i })).first());
    // Copied state may show a check icon — assert button still present / toast optional
    await this.shot("college_credentials_copied");
  }

  async done(): Promise<void> {
    await this.click(this.page.getByRole("button", { name: /Done.*Colleges/i }).or(this.page.getByRole("link", { name: /Done.*Colleges/i })));
    await expect(this.page).toHaveURL(/\/app\/superadmin\/colleges/);
  }
}
