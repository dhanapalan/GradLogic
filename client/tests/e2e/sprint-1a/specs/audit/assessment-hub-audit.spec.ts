/**
 * Assessment Hub — menu landing + per-page feature audit.
 *   npm run test:sprint1a:assessment-hub-audit
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN } from "../../config/env";
import { ASSESSMENT_HUB_FEATURE_CATALOG } from "../../data/assessment-hub-features";
import { runHubFeatureAudit } from "../../utils/hub-audit-runner";

test.describe("AUDIT — Assessment Hub menus + features", () => {
  test("Validate Assessment Hub landings and page features", async ({
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
      hubKey: "assessment-hub",
      hubTitle: "Assessment Hub",
      catalog: ASSESSMENT_HUB_FEATURE_CATALOG,
      page,
      consoleMon,
      networkMon,
      testInfo,
    });

    expect(summary.total).toBe(ASSESSMENT_HUB_FEATURE_CATALOG.length);
  });
});
