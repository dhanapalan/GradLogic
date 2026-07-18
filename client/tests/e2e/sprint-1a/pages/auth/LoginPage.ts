import { expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ROUTES, type LoginTabLabel } from "../../config/env";
import { expectToast } from "../../utils/assertions";

export class LoginPage extends BasePage {
  readonly path = ROUTES.login;
  readonly heading = /Welcome back/i;

  get identifier() {
    return this.page.locator("#identifier");
  }
  get password() {
    return this.page.locator("#password");
  }
  get signIn() {
    return this.page.getByRole("button", { name: /^Sign In$/i });
  }
  get roleTablist() {
    return this.page.getByRole("tablist", { name: "Login role" });
  }

  async open(role?: LoginTabLabel): Promise<void> {
    const q = role ? `?role=${encodeURIComponent(this.roleQuery(role))}` : "";
    await this.page.goto(`${ROUTES.login}${q}`, { waitUntil: "domcontentloaded" });
    await this.waitLoaded();
    if (role) await this.selectRole(role);
  }

  private roleQuery(label: LoginTabLabel): string {
    const map: Record<LoginTabLabel, string> = {
      Student: "student",
      Faculty: "faculty",
      "College Admin": "college",
      "Platform Admin": "platform_admin",
      Recruiter: "recruiter",
      "Company HR": "company_hr",
      "Super Admin": "super_admin",
    };
    return map[label];
  }

  async selectRole(label: LoginTabLabel): Promise<void> {
    await this.click(this.page.getByRole("tab", { name: label }));
    await expect(this.page.getByRole("tab", { name: label })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  }

  async loginAs(
    email: string,
    password: string,
    role: LoginTabLabel,
    opts?: { expectApi?: boolean }
  ): Promise<void> {
    const d = this.diag();
    const run = async () => {
      await this.open(role);
      await this.lifecycle("before-login", role);
      await this.validate({
        urlIncludes: /\/auth\/login/,
        heading: this.heading,
        requiredControls: [this.identifier, this.password, this.signIn, this.roleTablist],
        screenshot: `login_${role.replace(/\s+/g, "_")}_ready`,
        allowConsoleNoise: true,
      });

      await this.type(this.identifier, email);
      await this.type(this.password, password);
      await this.click(this.signIn);

      if (opts?.expectApi !== false) {
        await this.page
          .waitForResponse(
            (r) => r.url().includes("/auth/login") && r.request().method() === "POST",
            { timeout: 30_000 }
          )
          .catch(() => undefined);
      }
      await this.lifecycle("after-login", role);
    };

    if (d) {
      const { QUALITY } = await import("../../config/quality.config");
      await d.logger.step(`loginAs:${role}`, "authenticated session established or error handled", async () => {
        await d.perf.measure("login", run, QUALITY.loginBudgetMs, { role, email });
      });
    } else {
      await run();
    }
  }

  async expectRoleMismatchToast(): Promise<void> {
    await expectToast(this.page, /Please use the|cannot sign in from/i);
    await expect(this.page).toHaveURL(/\/auth\/login/);
  }

  async expectStillOnLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/auth\/login/);
    await expect(this.signIn).toBeVisible();
  }
}
