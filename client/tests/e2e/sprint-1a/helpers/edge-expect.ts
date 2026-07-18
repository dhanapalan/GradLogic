/**
 * Shared edge-case assertion helpers — wraps existing utils only.
 */
import { Page, expect, APIResponse } from "@playwright/test";
import { expectToast } from "../utils/assertions";
import { stepScreenshot } from "../utils/interactions";
import type { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";

export async function expectErrorToast(
  page: Page,
  pattern: string | RegExp,
  shot?: string
): Promise<void> {
  await expectToast(page, pattern);
  if (shot) await stepScreenshot(page, shot);
}

export async function expectStillOnUrl(page: Page, pattern: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(pattern);
}

export async function expectApiStatus(
  response: APIResponse | null | undefined,
  statuses: number[],
  context: string
): Promise<void> {
  expect(response, `${context}: expected an API response`).toBeTruthy();
  expect(
    statuses,
    `${context}: HTTP ${response!.status()} not in [${statuses.join(", ")}]`
  ).toContain(response!.status());
}

export async function waitForApi(
  page: Page,
  pathIncludes: string,
  method: string,
  timeout = 30_000
) {
  return page.waitForResponse(
    (r) =>
      r.url().includes(pathIncludes) &&
      r.request().method().toUpperCase() === method.toUpperCase(),
    { timeout }
  );
}

export async function expectUiFormIntact(
  page: Page,
  heading: string | RegExp
): Promise<void> {
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await expect(page.locator("body")).toBeVisible();
}

export async function expectNoUnhandledJs(
  consoleMon: ConsoleMonitor,
  context: string
): Promise<void> {
  consoleMon.assertClean(context);
}

export function lastApi(
  networkMon: NetworkMonitor,
  path: string,
  method?: string
) {
  return networkMon.findLast(path, method);
}

/**
 * Simulate a fully logged-out session.
 *
 * Post the httpOnly-refresh-cookie migration, the access token lives in
 * memory only and the refresh token is an httpOnly cookie — neither can be
 * read or cleared from page JS (writing to sessionStorage/localStorage no
 * longer does anything, since the app doesn't read tokens from there).
 * Playwright's browser-context API can still clear the cookie directly;
 * combined with clearing the non-token auth-store state (user/permissions/
 * remember-me, which IS still kept in web storage) this fully reproduces
 * "logged out" from the app's perspective.
 */
export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      localStorage.removeItem("permissions");
      localStorage.removeItem("authRememberMe");
    } catch {
      /* ignore */
    }
  });
}

/**
 * Simulate an irrecoverably invalid session (expired/corrupted credentials).
 *
 * Writing a garbage token into sessionStorage no longer has any effect — the
 * app doesn't read its access token from storage at all. This instead makes
 * every /api/** call (including the silent-refresh call itself) return 401,
 * so the app's real interceptor logic runs: it attempts a silent refresh,
 * that also fails, and it force-logs-out to /auth/login — the same behavior
 * a genuinely corrupted/expired credential triggers in production.
 */
export async function corruptAccessToken(page: Page): Promise<void> {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: "Unauthorized" }),
    })
  );
}
