/**
 * Learning Hub audit — navigate EVERY menu AND validate page-specific features.
 *
 * Landing checks: URL, heading, browser title, breadcrumb, console, API noise, screenshot
 * Feature checks: per-page matrix (search, filters, list, pagination, create, tabs, …)
 *
 *   npm run test:sprint1a:learning-hub-audit
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN } from "../../config/env";
import { LEARNING_HUB_FEATURE_CATALOG } from "../../data/learning-hub-features";
import { runHubFeatureAudit } from "../../utils/hub-audit-runner";

test.describe("AUDIT — Learning Hub menus + features", () => {
  test("Validate every Learning Hub menu landing AND its page features", async ({
    loginPage,
    page,
    consoleMon,
    networkMon,
  }, testInfo) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });
    test.info().annotations.push({ type: "stability", description: "skip-ui-gates" });
    test.setTimeout(900_000);

    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    const { summary } = await runHubFeatureAudit({
      hubKey: "learning-hub",
      hubTitle: "Learning Hub",
      catalog: LEARNING_HUB_FEATURE_CATALOG,
      page,
      consoleMon,
      networkMon,
      testInfo,
    });

    expect(summary.total).toBe(LEARNING_HUB_FEATURE_CATALOG.length);
  });
});
