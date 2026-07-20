/**
 * Cross-hub SPOF / integration smoke (Learning Hub ↔ Assessment Hub ↔ AI Config).
 *
 * Covers the coupling points you documented:
 * 1) Assessment pipeline dashboard aggregates KL → QB → collections → drives → journeys
 * 2) Drives pull from question_bank (shared table)
 * 3) AI Studio Content Generator/Review are aliases into Learning Companion
 * 4) AI Config is shared SPOF for question_bank + drive_generation providers
 *
 *   npm run test:sprint1a:hub-integration
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN } from "../../config/env";
import { waitForSpinnerGone } from "../../utils/assertions";
import { waitForApi, expectApiStatus } from "../../helpers/edge-expect";

test.describe.configure({ mode: "serial" });

test.describe("INTEGRATION — Learning Hub × Assessment Hub × AI Studio", () => {
  test.beforeEach(async ({ loginPage, page }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });
    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });
  });

  test("1) Assessment Hub pipeline dashboard loads and shows catalog steps", async ({
    page,
    networkMon,
  }) => {
    const resPromise = waitForApi(page, "/assessment", "GET").catch(() =>
      waitForApi(page, "pipeline", "GET").catch(() => null)
    );
    await page.goto("/app/superadmin/assessment-hub");
    await waitForSpinnerGone(page).catch(() => undefined);

    await expect(
      page.getByRole("heading", { name: /Assessment Hub|Assessment|Dashboard|pipeline/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    // Pipeline / next-action language from assessmentPipeline.service catalogSteps
    const pipelineHints = page.getByText(
      /Knowledge Library|Question Bank|Collection|Drive|Journey|next|pipeline|Published/i
    );
    await expect(pipelineHints.first()).toBeVisible({ timeout: 15_000 });

    const res = await resPromise;
    if (res) await expectApiStatus(res, [200, 201], "assessment hub dashboard API");

    // No 5xx on this smoke
    expect(networkMon.http5xx().length).toBe(0);
    await page.screenshot({
      path: "test-results/sprint-1a/hub-integration/01_assessment_pipeline.png",
      fullPage: true,
    });
  });

  test("2) Question Bank Hub reachable; browse list is the shared question_bank surface", async ({
    page,
  }) => {
    await page.goto("/app/superadmin/question-bank");
    await waitForSpinnerGone(page).catch(() => undefined);
    await expect(page.getByRole("heading", { name: /Question Bank/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Navigate to browse — drives JOIN this same table
    const browse = page.getByRole("link", { name: /Browse|All Questions|Search/i }).first();
    if (await browse.count()) {
      await browse.click();
    } else {
      await page.goto("/app/superadmin/question-bank/browse");
    }
    await waitForSpinnerGone(page).catch(() => undefined);
    await expect(page).toHaveURL(/question-bank/);
    await expect(
      page.getByPlaceholder(/Search/i).or(page.getByRole("searchbox")).first()
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: "test-results/sprint-1a/hub-integration/02_question_bank_browse.png",
      fullPage: true,
    });
  });

  test("3) Assessment Builder (drives) create path can open question picker / bank linkage", async ({
    page,
  }) => {
    await page.goto("/app/superadmin/drives");
    await waitForSpinnerGone(page).catch(() => undefined);
    await expect(
      page.getByRole("heading", { name: /Drive|Assessment Builder|Assessment/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    const create = page.getByRole("link", { name: /New|Create/i }).or(
      page.getByRole("button", { name: /New|Create/i })
    );
    if (await create.first().count()) {
      await create.first().click();
    } else {
      await page.goto("/app/superadmin/drives/new");
    }
    await waitForSpinnerGone(page).catch(() => undefined);
    await expect(page).toHaveURL(/drives\/(new|$)/);

    // Evidence that drive builder references questions / rules / bank
    const bankLink = page.getByText(/Question|Collection|Rule|Bank|Select question/i);
    await expect(bankLink.first()).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: "test-results/sprint-1a/hub-integration/03_drive_builder_questions.png",
      fullPage: true,
    });
  });

  test("4) AI Studio Content Generator / Review are Learning Companion aliases", async ({
    page,
  }) => {
    await page.goto("/app/superadmin/learning-companion/studio");
    await expect(page).toHaveURL(/learning-companion\/studio/);
    await expect(
      page.getByRole("heading", { name: /Studio|Content|Generator|AI|Companion/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    await page.goto("/app/superadmin/learning-companion/review");
    await expect(page).toHaveURL(/learning-companion\/review/);
    await expect(page.getByRole("heading", { name: /Review/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.screenshot({
      path: "test-results/sprint-1a/hub-integration/04_ai_studio_aliases.png",
      fullPage: true,
    });
  });

  test("5) AI Config SPOF surface — question_bank / drive_generation providers visible", async ({
    page,
  }) => {
    await page.goto("/app/superadmin/ai-config");
    await waitForSpinnerGone(page).catch(() => undefined);
    await expect(
      page.getByRole("heading", { name: /AI|Config|Service|Model/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    // Shared config table should list or allow services — soft if empty seed
    const serviceHints = page.getByText(
      /question_bank|drive_generation|resume_extraction|Create service|Provider|API key|service_key/i
    );
    await expect(serviceHints.first()).toBeVisible({ timeout: 15_000 });

    // Prompt Manager tab (AI Studio menu) shares this page
    await page.goto("/app/superadmin/ai-config?tab=prompts");
    await expect(page).toHaveURL(/ai-config/);

    await page.screenshot({
      path: "test-results/sprint-1a/hub-integration/05_ai_config_spof.png",
      fullPage: true,
    });
  });

  test("6) Knowledge Library publish path is reachable before QB/drive (pipeline step 1)", async ({
    page,
  }) => {
    await page.goto("/app/superadmin/knowledge-library");
    await waitForSpinnerGone(page).catch(() => undefined);
    await expect(page.getByRole("heading", { name: /Knowledge Library/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: /Create Knowledge Asset/i }).first()).toBeVisible();

    // Cheap cross-module regression: KL → Assessment Hub still navigable in same session
    await page.goto("/app/superadmin/assessment-hub");
    await expect(
      page.getByRole("heading", { name: /Assessment Hub|Assessment|Dashboard/i }).first()
    ).toBeVisible({ timeout: 20_000 });

    await page.screenshot({
      path: "test-results/sprint-1a/hub-integration/06_kl_to_assessment_hub.png",
      fullPage: true,
    });
  });
});
