import { expect } from "@playwright/test";
import path from "node:path";
import { BasePage } from "../BasePage";
import { ROUTES } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class StudentProfilePage extends BasePage {
  readonly path = ROUTES.studentProfile;
  readonly heading = /My Profile/i;

  get sectionNav() {
    return this.page.getByRole("navigation", { name: "Profile sections" });
  }

  sectionTab(label: string) {
    return this.sectionNav.getByRole("button", { name: label, exact: true });
  }

  async open(section?: string): Promise<void> {
    const q = section ? `?section=${section}` : "";
    await this.page.goto(`${this.path}${q}`, { waitUntil: "domcontentloaded" });
    await this.waitLoaded();
    await expect(this.page.getByRole("heading", { name: this.heading })).toBeVisible();
  }

  async goToSection(section: string, label: string): Promise<void> {
    await this.click(this.sectionTab(label));
    await expect(this.page).toHaveURL(new RegExp(`section=${section}`));
  }

  // ── Skills ────────────────────────────────────────────────────────────
  get addSkill() {
    return this.page.getByRole("button", { name: /^Add$/i });
  }
  get saveSkills() {
    return this.page.getByRole("button", { name: /Save skills/i });
  }
  get lastSkillNameInput() {
    return this.page.getByLabel("Skill name").last();
  }

  async addAndSaveSkill(name: string): Promise<void> {
    await this.click(this.addSkill);
    await this.type(this.lastSkillNameInput, name);
    await this.click(this.saveSkills);
    await expectToast(this.page, /Skills saved/i);
  }

  skillRow(name: string) {
    return this.page.locator("li").filter({ hasText: name });
  }

  async removeSkill(name: string): Promise<void> {
    const row = this.skillRow(name);
    await this.click(row.getByRole("button", { name: /Remove skill/i }));
    await this.click(this.saveSkills);
    await expectToast(this.page, /Skills saved/i);
  }

  // ── Resume ────────────────────────────────────────────────────────────
  get resumeFileInput() {
    return this.page.locator('input[type="file"]');
  }
  get deleteResume() {
    return this.page.getByRole("button", { name: /Delete/i });
  }
  get downloadResume() {
    return this.page.getByRole("link", { name: /Download/i });
  }

  async uploadResume(fileName: string): Promise<void> {
    await this.resumeFileInput.setInputFiles(path.join(__dirname, "../../fixtures/files", fileName));
    await expectToast(this.page, /Resume uploaded/i, 20_000);
  }

  async removeResume(): Promise<void> {
    await this.click(this.deleteResume);
    await expectToast(this.page, /Resume removed/i);
  }
}
