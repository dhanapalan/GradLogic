import type { Page } from "@playwright/test";
import { ROUTES } from "../config/env";

/** Clear auth storage so role switches (SA → college → student) do not reuse tokens. */
export async function clearAuthSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(ROUTES.login, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
}
