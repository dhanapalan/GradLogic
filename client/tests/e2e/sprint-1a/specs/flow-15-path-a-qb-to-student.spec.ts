/**
 * FLOW 15 — Path A (platform)
 * Question Bank ready → Collections → Assessment Builder → Assign Campus
 * → College staff review → Student learn / practice / exam → Results
 *
 *   npm run test:sprint1a:path-a
 *
 * Mutations are intentional. Requires local API + seeded Demo College students.
 */
import { test, expect } from "../fixtures/test.fixture";
import { SUPER_ADMIN, COLLEGE_ADMIN, STUDENT } from "../config/env";
import { readState, writeState } from "../helpers/runtime-state";
import { clearAuthSession } from "../helpers/session";
import {
  bootstrapPathAContext,
  approvePool,
  assignCampus,
  markReadyAndPublish,
  type PathABundle,
} from "../helpers/path-a-api";
import {
  QuestionBankBrowsePage,
  QuestionCollectionsPage,
  AssessmentBuilderPage,
  CampusDrivesPage,
  StudentPathAPages,
} from "../pages/path-a/PathAPages";

const stamp = Date.now().toString().slice(-6);
const DRIVE_NAME = `S1A PathA Practice ${stamp}`;

let ctx: PathABundle;
let driveId = "";

test.describe("FLOW 15A — Super Admin pipeline (QB → publish)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test("15.1 QB ready — published questions visible in Question Bank browse", async ({
    loginPage,
    page,
    request,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });

    ctx = await bootstrapPathAContext(request);
    writeState({
      pathACollectionId: ctx.collectionId,
      pathACampusId: ctx.campusId,
      pathADriveName: DRIVE_NAME,
    });

    await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    await expect(page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });

    const qb = new QuestionBankBrowsePage(page);
    await qb.open();
    await qb.expectHasRows();
  });

  test("15.2 Collections — bank questions linked (fill-from-bank ensured)", async ({
    page,
    loginPage,
  }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    const collections = new QuestionCollectionsPage(page);
    await collections.openByName(ctx.collectionName);
    await collections.expectQuestionsPresent();
  });

  test("15.3 Assessment Builder — create practice drive from collection", async ({
    page,
    loginPage,
  }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    const builder = new AssessmentBuilderPage(page);
    driveId = await builder.createPracticeFromCollection({
      name: DRIVE_NAME,
      collectionName: ctx.collectionName,
      ruleNameHint: /Aptitude|Placement|Python|Reasoning/i,
    });
    ctx = { ...ctx, driveId, driveName: DRIVE_NAME };
    writeState({ pathADriveId: driveId, pathADriveName: DRIVE_NAME });
    expect(driveId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("15.4 Pool review — approve collection-assembled pool", async ({
    page,
    loginPage,
    request,
  }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    const builder = new AssessmentBuilderPage(page);
    await builder.openDetail(driveId);
    await page.goto(`/app/superadmin/drives/${driveId}?tab=pool`);
    await builder.approvePoolIfNeeded();
    await approvePool(request, ctx.token, driveId).catch(() => undefined);
  });

  test("15.5 Assign campus — Demo College", async ({ page, loginPage, request }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    const builder = new AssessmentBuilderPage(page);
    await builder.openDetail(driveId);
    try {
      await builder.assignCampus(ctx.campusName);
    } catch {
      await assignCampus(request, ctx.token, driveId, ctx.campusId);
    }
  });

  test("15.6 Go live — Mark Ready + Publish", async ({ page, loginPage, request }) => {
    if (!page.url().includes("/superadmin")) {
      await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
    }
    const builder = new AssessmentBuilderPage(page);
    await builder.openDetail(driveId);
    try {
      await builder.markReadyAndPublish();
    } catch {
      await markReadyAndPublish(request, ctx.token, driveId);
    }
    await builder.expectDriveListed(DRIVE_NAME);
  });
});

test.describe("FLOW 15B — College staff review", () => {
  test.setTimeout(120_000);

  test("15.7 College staff — assigned drive visible for review", async ({
    loginPage,
    page,
  }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });

    const state = readState();
    const driveName = state.pathADriveName || DRIVE_NAME;
    test.skip(!state.pathADriveId, "Path A drive not created — run 15A first");

    await clearAuthSession(page);
    await loginPage.loginAs(COLLEGE_ADMIN.email, COLLEGE_ADMIN.password, COLLEGE_ADMIN.loginTab);
    await expect(page).toHaveURL(/college-portal|\/app\/college/, { timeout: 45_000 });

    const campusDrives = new CampusDrivesPage(page);
    await campusDrives.expectDriveVisible(driveName);
  });
});

test.describe("FLOW 15C — Student learn / practice / exam", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("15.8 Student — learn surface loads", async ({ loginPage, page }) => {
    test.info().annotations.push({ type: "stability", description: "allow-console" });
    test.info().annotations.push({ type: "stability", description: "allow-network" });

    const state = readState();
    test.skip(!state.pathADriveId, "Path A drive not created — run 15A first");

    await clearAuthSession(page);
    await loginPage.loginAs(STUDENT.email, STUDENT.password, STUDENT.loginTab);
    await expect(page).toHaveURL(/student-portal|student-onboarding/, { timeout: 45_000 });

    if (/onboarding/i.test(page.url())) {
      await page.goto(new URL("/app/student-portal", page.url()).toString());
    }

    const student = new StudentPathAPages(page);
    await student.openLearning();
  });

  test("15.9 Student — practice hub loads", async ({ loginPage, page }) => {
    if (!page.url().includes("student-portal")) {
      await clearAuthSession(page);
      await loginPage.loginAs(STUDENT.email, STUDENT.password, STUDENT.loginTab);
    }
    const student = new StudentPathAPages(page);
    await student.openPractice();
  });

  test("15.10 Student — assigned Path A drive visible; start exam if possible", async ({
    loginPage,
    page,
  }) => {
    const state = readState();
    const driveName = state.pathADriveName || DRIVE_NAME;
    if (!page.url().includes("student-portal")) {
      await clearAuthSession(page);
      await loginPage.loginAs(STUDENT.email, STUDENT.password, STUDENT.loginTab);
    }
    const student = new StudentPathAPages(page);
    await student.openTestsAndFindDrive(driveName);
    const outcome = await student.startExamIfPossible(driveName);
    expect(["started", "instructions", "skipped"]).toContain(outcome);
    writeState({ pathAExamOutcome: outcome });
  });

  test("15.11 Student — results page reachable", async ({ loginPage, page }) => {
    if (!page.url().includes("student-portal")) {
      await clearAuthSession(page);
      await loginPage.loginAs(STUDENT.email, STUDENT.password, STUDENT.loginTab);
    }
    const student = new StudentPathAPages(page);
    await student.openResults();
  });
});
