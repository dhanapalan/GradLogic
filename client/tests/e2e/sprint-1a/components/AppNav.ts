import { Page, Locator, expect } from "@playwright/test";
import { highlightClick } from "../utils/interactions";
import { getDiagnostics } from "../diagnostics/context";

/** Portal chrome: sidebar / top nav / logout / profile / notifications. */
export class AppNav {
  constructor(private readonly page: Page) {}

  link(name: string | RegExp): Locator {
    return this.page.getByRole("link", { name }).first();
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole("button", { name }).first();
  }

  async openNavItem(name: string | RegExp): Promise<void> {
    const link = this.link(name);
    const btn = this.button(name);
    const d = getDiagnostics(this.page);
    if (await link.count()) {
      await d?.shots.capture(this.page, "after-navigation", String(name));
      await highlightClick(link);
    } else {
      await highlightClick(btn);
    }
  }

  async logout(): Promise<void> {
    const d = getDiagnostics(this.page);
    await d?.shots.capture(this.page, "before-logout");
    const logout = this.page.getByRole("button", { name: /^Logout$/i })
      .or(this.page.getByRole("link", { name: /^Logout$/i }))
      .or(this.page.getByText(/^Logout$/i));
    await highlightClick(logout.first());
  }

  async expectProfileVisible(nameOrEmail?: string | RegExp): Promise<void> {
    if (nameOrEmail) {
      await expect(this.page.getByText(nameOrEmail).first()).toBeVisible();
    } else {
      // Profile affordance — avatar button or user menu
      const profile = this.page
        .locator("[aria-label*='profile' i], [aria-label*='account' i], [aria-label*='user' i]")
        .first()
        .or(this.page.getByRole("button", { name: /profile|account|user/i }).first());
      await expect(profile.or(this.page.getByText(/Welcome back/i).first())).toBeVisible();
    }
  }

  async expectNotificationsAffordance(): Promise<void> {
    const n = this.page
      .getByRole("link", { name: /Notifications/i })
      .or(this.page.getByRole("button", { name: /Notifications/i }))
      .or(this.page.locator("[aria-label*='notification' i]"));
    await expect(n.first()).toBeVisible();
  }
}
