import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { expectToast } from "../../utils/assertions";

/**
 * Maps to the live wizard in StudentOnboardingWizard.tsx:
 * Welcome → Personal → Academic → Skills → Career Goals → Resume → Terms → Success
 *
 * (Product brief "Interests / Certifications / Review" map to Skills / Career / Terms.)
 */
export class StudentOnboardingPage extends BasePage {
  readonly path = ROUTES.studentOnboarding;
  readonly heading = /Welcome|Personal|Academic|Skills|Career|Resume|Terms|Success/i;

  get continueBtn() {
    return this.page.getByRole("button", { name: /^Continue$/i });
  }
  get backBtn() {
    return this.page.getByRole("button", { name: /^Back$/i });
  }
  get finishBtn() {
    return this.page.getByRole("button", { name: /^Finish$/i });
  }
  get goToPortal() {
    return this.page.getByRole("button", { name: /Go to Student Portal/i }).or(
      this.page.getByRole("link", { name: /Go to Student Portal/i })
    );
  }

  field(name: string) {
    return this.page.locator(`[name="${name}"]`);
  }

  async expectOnboarding(): Promise<void> {
    await this.waitLoaded();
    await expect(this.page).toHaveURL(/student-onboarding/);
    await this.shot("onboarding_start");
  }

  async expectStepTitle(title: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { name: title }).or(this.page.getByText(title)).first()).toBeVisible();
  }

  async continue(): Promise<void> {
    await this.click(this.continueBtn);
  }

  /** Step: Welcome */
  async completeWelcome(): Promise<void> {
    await this.expectStepTitle(/Welcome/i);
    await this.continue();
    await this.shot("onboarding_welcome_done");
  }

  /** Step: Personal Information */
  async completePersonal(data: {
    first_name: string;
    last_name: string;
    phone_number: string;
    dob?: string;
  }): Promise<void> {
    await this.expectStepTitle(/Personal/i);
    await this.type(this.field("first_name"), data.first_name);
    await this.type(this.field("last_name"), data.last_name);
    await this.type(this.field("phone_number"), data.phone_number);
    if (data.dob) {
      const dob = this.field("dob");
      if (await dob.count()) await dob.fill(data.dob);
    }
    await this.continue();
    await this.shot("onboarding_personal_done");
  }

  /** Step: Academic Information */
  async completeAcademic(data: {
    degree: string;
    specialization: string;
    roll_number: string;
    course_start_year?: string;
  }): Promise<void> {
    await this.expectStepTitle(/Academic/i);
    await this.type(this.field("degree"), data.degree);
    await this.type(this.field("specialization"), data.specialization);
    await this.type(this.field("roll_number"), data.roll_number);
    if (data.course_start_year) {
      await this.field("course_start_year").fill(data.course_start_year);
    }
    await this.continue();
    await this.shot("onboarding_academic_done");
  }

  /** Step: Skills (+ interests via skills free-text) */
  async completeSkills(skills = "JavaScript, TypeScript, React"): Promise<void> {
    await this.expectStepTitle(/Skills/i);
    const skillsField = this.field("skills");
    if (await skillsField.count()) await this.type(skillsField, skills);
    await this.continue();
    await this.shot("onboarding_skills_done");
  }

  /** Step: Career Goals */
  async completeCareer(goals = "Software Engineer at a product company"): Promise<void> {
    await this.expectStepTitle(/Career/i);
    const goalsField = this.field("career_goals");
    if (await goalsField.count()) await this.type(goalsField, goals);
    await this.continue();
    await this.shot("onboarding_career_done");
  }

  /** Step: Resume Upload — skip allowed */
  async skipResume(): Promise<void> {
    await this.expectStepTitle(/Resume/i);
    await this.continue();
    await this.shot("onboarding_resume_skipped");
  }

  /** Step: Terms & Privacy (review + accept) */
  async completeTermsAndSubmit(): Promise<void> {
    await this.expectStepTitle(/Terms|Privacy|Review/i);
    const accept = this.field("accept_terms").or(
      this.page.getByRole("checkbox", { name: /terms|privacy|agree/i })
    );
    await accept.first().check({ force: true }).catch(async () => {
      await this.click(accept.first());
    });
    await this.click(this.finishBtn);
    await this.page
      .waitForResponse(
        (r) => r.url().includes("/onboarding") && r.request().method() === "PUT",
        { timeout: 45_000 }
      )
      .catch(() => undefined);
    await expect(this.page.getByText(/Success|complete|portal/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectToast(this.page, /success|complete|saved/i).catch(() => undefined);
    await this.shot("onboarding_success");
  }

  async goToStudentPortal(): Promise<void> {
    if (await this.goToPortal.count()) {
      await this.click(this.goToPortal.first());
    } else {
      await this.page.goto(ROUTES.studentDashboard);
    }
  }
}
