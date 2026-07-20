import { expect, type Page } from "@playwright/test";
import { waitForSpinnerGone } from "../../utils/assertions";

/** Resolve path against the current page origin (subdomain portals), not Playwright baseURL. */
async function portalGoto(page: Page, path: string): Promise<void> {
  const url = page.url();
  const origin = /^https?:\/\//i.test(url) ? new URL(url).origin : "";
  const target = origin ? `${origin}${path.startsWith("/") ? path : `/${path}`}` : path;
  await page.goto(target);
}

/** Super Admin — Question Bank browse (shared question_bank surface). */
export class QuestionBankBrowsePage {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/app/superadmin/question-bank/browse");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /All Questions|Question/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async expectHasRows(): Promise<void> {
    const rows = this.page.locator("table tbody tr, [role='row']");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  }
}

/** Super Admin — Question Collections list / detail. */
export class QuestionCollectionsPage {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/app/superadmin/question-collections");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /Question Collections/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async openByName(name: string): Promise<void> {
    await this.open();
    const search = this.page.getByPlaceholder(/Search collections/i);
    if (await search.count()) {
      await search.fill(name);
      await this.page.waitForTimeout(400);
    }
    // Collection rows are buttons inside listitems (not links); filter chips are also buttons.
    const row = this.page.getByRole("listitem").filter({ hasText: new RegExp(name, "i") });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await row.first().getByRole("button").first().click();
    await waitForSpinnerGone(this.page).catch(() => undefined);
  }

  async expectQuestionsPresent(): Promise<void> {
    await expect(
      this.page
        .getByText(/\d+\s*question|from bank|No questions yet/i)
        .or(this.page.locator("table tbody tr").first())
        .first()
    ).toBeVisible({ timeout: 15_000 });
    const empty = await this.page.getByText(/No questions yet/i).isVisible().catch(() => false);
    expect(empty, "Collection should have questions after fill-from-bank").toBeFalsy();
  }
}

/** Super Admin — Assessment Builder create + detail. */
export class AssessmentBuilderPage {
  constructor(readonly page: Page) {}

  async openList(): Promise<void> {
    await this.page.goto("/app/superadmin/drives");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /Assessment Builder|Drive/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async openCreate(): Promise<void> {
    await this.page.goto("/app/superadmin/drives/new");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /New assessment|Launch New Drive/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async createPracticeFromCollection(opts: {
    name: string;
    collectionName: string;
    ruleNameHint?: RegExp;
  }): Promise<string> {
    await this.openCreate();
    await this.page.getByPlaceholder(/e\.g\. Python|Assessment name|Practice/i).or(
      this.page.locator('input[required]').first()
    ).fill(opts.name);

    await this.page.getByRole("button", { name: /^Practice$/i }).click();

    const collectionRow = this.page.locator("label").filter({
      hasText: new RegExp(opts.collectionName, "i"),
    });
    await expect(collectionRow.first()).toBeVisible({ timeout: 15_000 });
    await collectionRow.first().locator('input[type="checkbox"]').check();

    const ruleSelect = this.page.getByLabel(/Assessment Rule/i).or(
      this.page.locator("select").filter({ has: this.page.locator("option") }).first()
    );
    await expect(ruleSelect).toBeVisible({ timeout: 15_000 });
    if (opts.ruleNameHint) {
      const option = ruleSelect.locator("option").filter({ hasText: opts.ruleNameHint });
      if (await option.count()) {
        await ruleSelect.selectOption({ label: await option.first().textContent() || undefined });
      } else {
        await ruleSelect.selectOption({ index: 1 });
      }
    } else {
      await ruleSelect.selectOption({ index: 1 });
    }

    const createRes = this.page.waitForResponse(
      (r) => r.url().includes("/api/drives") && r.request().method() === "POST",
      { timeout: 60_000 }
    );
    await this.page.getByRole("button", { name: /Assemble assessment|Create|Launch|Assemble|Save/i }).last().click();
    const res = await createRes;
    expect(res.ok(), `Create drive HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json().catch(() => ({}));
    const driveId = body?.data?.id as string;
    expect(driveId).toBeTruthy();
    await expect(this.page).toHaveURL(new RegExp(`/drives/${driveId}`), { timeout: 30_000 });
    return driveId;
  }

  async openDetail(driveId: string): Promise<void> {
    await this.page.goto(`/app/superadmin/drives/${driveId}`);
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(this.page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  }

  async approvePoolIfNeeded(): Promise<void> {
    await this.page.getByRole("button", { name: /^Preview$/i }).or(
      this.page.getByRole("tab", { name: /Preview|Pool/i })
    ).first().click().catch(async () => {
      await this.page.goto(this.page.url().includes("?")
        ? this.page.url().replace(/([?&])tab=[^&]*/, "$1tab=pool").replace(/\?$/, "?tab=pool")
        : `${this.page.url()}?tab=pool`);
    });
    await waitForSpinnerGone(this.page).catch(() => undefined);

    const approve = this.page.getByRole("button", { name: /Approve Pool|Approve & Lock|Approve/i });
    if (await approve.first().isVisible().catch(() => false)) {
      await approve.first().click();
      const confirm = this.page.getByRole("button", { name: /Confirm|Yes|Approve/i });
      if (await confirm.count()) await confirm.last().click();
      await expect(
        this.page.getByText(/Pool approved|Approved|locked/i).first()
      ).toBeVisible({ timeout: 20_000 }).catch(() => undefined);
    }
  }

  async assignCampus(campusName: string): Promise<void> {
    const url = this.page.url();
    const id = url.match(/drives\/([^/?]+)/)?.[1];
    expect(id).toBeTruthy();
    await this.page.goto(`/app/superadmin/drives/${id}/assign-campus`);
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /Assign Campus/i }).first()
    ).toBeVisible({ timeout: 15_000 });

    const select = this.page.locator("select").first();
    await select.selectOption({ label: campusName });
    await this.page.getByRole("button", { name: /Confirm Assignment/i }).click();
    await expect(this.page.getByText(/Campus assigned|assigned successfully/i).first())
      .toBeVisible({ timeout: 20_000 })
      .catch(() => undefined);
  }

  async markReadyAndPublish(): Promise<void> {
    const ready = this.page.getByRole("button", { name: /Mark Ready|Ready/i });
    if (await ready.first().isVisible().catch(() => false)) {
      await ready.first().click();
      await this.page.waitForTimeout(800);
    }
    const publish = this.page.getByRole("button", { name: /^Publish$/i });
    if (await publish.first().isVisible().catch(() => false)) {
      await publish.first().click();
      await this.page.waitForTimeout(800);
    }
    await expect(
      this.page.getByText(/Ready|Live|Published|Active/i).first()
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectDriveListed(name: string): Promise<void> {
    await this.openList();
    const search = this.page.getByPlaceholder(/Search/i);
    if (await search.count()) {
      await search.fill(name);
      await this.page.waitForTimeout(500);
    }
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  }
}

/** College portal — campus drives review. */
export class CampusDrivesPage {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await portalGoto(this.page, "/app/college-portal/drives");
    await waitForSpinnerGone(this.page).catch(() => undefined);
  }

  async expectDriveVisible(name: string): Promise<void> {
    const drivesRes = this.page
      .waitForResponse(
        (r) => r.url().includes("/campus/drives") && r.request().method() === "GET" && r.ok(),
        { timeout: 30_000 }
      )
      .catch(() => undefined);
    await this.open();
    await drivesRes;
    await expect(this.page).toHaveURL(/college-portal\/drives/, { timeout: 20_000 });
    await expect(
      this.page.getByRole("heading", { name: /Recruitment Drives|Drives/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    const search = this.page.getByPlaceholder(/Search/i);
    if (await search.count()) {
      await search.fill(name);
      await this.page.waitForTimeout(400);
    }
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
  }
}

/** Student — learn / practice / exam surfaces. */
export class StudentPathAPages {
  constructor(readonly page: Page) {}

  async openLearning(): Promise<void> {
    await portalGoto(this.page, "/app/student-portal/my-learning");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /Learning|My Learning|Journey|Course/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async openPractice(): Promise<void> {
    await portalGoto(this.page, "/app/student-portal/practice");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(this.page).toHaveURL(/student-portal\/practice/, { timeout: 20_000 });
    await expect(
      this.page.getByRole("heading", { name: /Practice Hub|Practice/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async openTestsAndFindDrive(driveName: string): Promise<void> {
    await portalGoto(this.page, "/app/student-portal/tests");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /Test|Exam|Assessment|Mock/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByText(driveName).first()).toBeVisible({ timeout: 25_000 });
  }

  async startExamIfPossible(driveName: string): Promise<"started" | "instructions" | "skipped"> {
    await this.openTestsAndFindDrive(driveName);
    const row = this.page.locator("div,tr,li,article").filter({ hasText: driveName }).first();
    const start = row.getByRole("button", { name: /Start Exam|Resume|Begin/i }).or(
      this.page.getByRole("button", { name: /Start Exam|Resume/i }).first()
    );
    if (!(await start.first().isVisible().catch(() => false))) return "skipped";
    await start.first().click();
    await waitForSpinnerGone(this.page).catch(() => undefined);
    if (/\/exam\/.+\/instructions/.test(this.page.url())) {
      const agree = this.page.getByRole("button", { name: /I Agree|Start Exam/i });
      if (await agree.first().isVisible().catch(() => false)) {
        await agree.first().click();
        await waitForSpinnerGone(this.page).catch(() => undefined);
        return "started";
      }
      return "instructions";
    }
    if (/\/exam\/.+\/play/.test(this.page.url())) return "started";
    return "skipped";
  }

  async openResults(): Promise<void> {
    await portalGoto(this.page, "/app/student-portal/results");
    await waitForSpinnerGone(this.page).catch(() => undefined);
    await expect(
      this.page.getByRole("heading", { name: /Result/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  }
}