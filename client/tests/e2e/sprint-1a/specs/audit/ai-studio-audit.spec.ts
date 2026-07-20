/**
 * AI Studio — menu landing + per-page feature audit (includes Learning Companion aliases).
 *   npm run test:sprint1a:ai-studio-audit
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN } from "../../config/env";
import { AI_STUDIO_FEATURE_CATALOG } from "../../data/ai-studio-features";
import { runHubFeatureAudit } from "../../utils/hub-audit-runner";

test.describe("AUDIT — AI Studio menus + features", () => {
  test("Validate AI Studio landings and page features", async ({
    loginPage,
    page,
    consoleMon,
    networkMon,
  }, testInfo) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });
    test.info().annotations.push({ type: "stability", description: "skip-ui-gates" });
    test.setTimeout(600_000);

    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    const { summary, rows } = await runHubFeatureAudit({
      hubKey: "ai-studio",
      hubTitle: "AI Studio",
      catalog: AI_STUDIO_FEATURE_CATALOG,
      page,
      consoleMon,
      networkMon,
      testInfo,
    });

    // Alias integrity: Content Generator / Review Center must land on learning-companion paths
    const studio = rows.find((r) => r.id === "ai-content-generator");
    expect(studio?.url || "").toMatch(/learning-companion\/studio/);
    const review = rows.find((r) => r.id === "ai-review-center");
    expect(review?.url || "").toMatch(/learning-companion\/review/);

    expect(summary.total).toBe(AI_STUDIO_FEATURE_CATALOG.length);
  });
});
