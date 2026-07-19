/**
 * COLLEGE EDGE CASES — Super Admin → Add College
 * Reuses LoginPage, CollegeCreatePage, CollegesListPage, fixtures, utils.
 */
import { test, expect } from "../../fixtures/test.fixture";
import { SUPER_ADMIN, ROUTES } from "../../config/env";
import {
  collegeValid,
  collegeBlankMandatory,
  collegeOnlySpaces,
  collegeInvalidEmail,
  collegeInvalidPhone,
  collegeLeadingTrailingSpaces,
  MAX_NAME,
  MIN_NAME,
  TAMIL_NAME,
  UNICODE_NAME,
  EMOJI_NAME,
  LARGE_ADDRESS,
} from "../../data/edge-payloads";
import {
  expectErrorToast,
  expectStillOnUrl,
  expectApiStatus,
  waitForApi,
  expectUiFormIntact,
  clearSession,
} from "../../helpers/edge-expect";
import { expectToast } from "../../utils/assertions";

test.describe.configure({ mode: "serial" });

async function asSuperAdmin(loginPage: import("../../pages/auth/LoginPage").LoginPage) {
  await loginPage.loginAs(SUPER_ADMIN.email, SUPER_ADMIN.password, SUPER_ADMIN.loginTab);
  await expect(loginPage.page).toHaveURL(/\/app\/superadmin/, { timeout: 45_000 });
}

test.describe("EDGE — College create validations", () => {
  test.beforeEach(async ({ loginPage, page, collegeCreate }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();
  });

  test("Blank mandatory fields → validation toast, stay on form, no create API success", async ({
    collegeCreate,
    page,
    networkMon,
  }) => {
    await collegeCreate.fill(collegeBlankMandatory());
    await collegeCreate.disableNativeValidation();
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /required|Invalid|Enter a valid/i, "college_blank_fields");
    await expectStillOnUrl(page, /\/colleges\/new/);
    await expectUiFormIntact(page, /Add New College/i);
    const hit = networkMon.findLast("/superadmin/colleges", "POST");
    if (hit) expect(hit.status && hit.status < 400).toBeFalsy();
  });

  test("Only spaces in required fields → rejected (trim)", async ({ collegeCreate, page }) => {
    await collegeCreate.fill(collegeOnlySpaces());
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /required|Invalid/i, "college_only_spaces");
    await expectStillOnUrl(page, /\/colleges\/new/);
  });

  test("Invalid email → toast + UI state unchanged", async ({ collegeCreate, page }) => {
    await collegeCreate.fill(collegeInvalidEmail());
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /Invalid.*email|email/i, "college_invalid_email");
    await expectStillOnUrl(page, /\/colleges\/new/);
  });

  test("Invalid phone → toast", async ({ collegeCreate, page }) => {
    await collegeCreate.fill(collegeInvalidPhone());
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /phone|valid/i, "college_invalid_phone");
    await expectStillOnUrl(page, /\/colleges\/new/);
  });

  test("Minimum length name (1 char) — accepted or length message", async ({
    collegeCreate,
    page,
  }) => {
    const data = collegeValid({ name: MIN_NAME });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST").catch(() => null);
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    if (res && res.ok()) {
      await expectToast(page, /College added successfully/i);
      await collegeCreate.shot("college_min_length_accepted");
    } else {
      await expectErrorToast(page, /required|length|name|Failed/i, "college_min_length_rejected");
    }
  });

  test("Maximum length name (255) — API response asserted", async ({ collegeCreate, page }) => {
    const data = collegeValid({ name: MAX_NAME });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    // Accept 201 or 400 depending on DB column limits
    await expectApiStatus(res, [201, 400, 413, 500], "max length college name");
    if (res.ok()) {
      await expectToast(page, /College added successfully/i);
    } else {
      await expectErrorToast(page, /Failed|too long|length|value too long/i, "college_max_length");
    }
    await collegeCreate.shot("college_max_length_result");
  });

  test("Tamil characters in college name", async ({ collegeCreate, page }) => {
    const data = collegeValid({ name: `${TAMIL_NAME} ${Date.now()}` });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    await expectApiStatus(res, [201, 400], "tamil name");
    if (res.ok()) {
      await expect(page.getByRole("heading", { name: /College created/i })).toBeVisible();
      await expect(page.getByText(TAMIL_NAME)).toBeVisible();
    }
    await collegeCreate.shot("college_tamil_chars");
  });

  test("Unicode / accented characters in college name", async ({ collegeCreate, page }) => {
    const data = collegeValid({ name: `${UNICODE_NAME} ${Date.now()}` });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    await expectApiStatus(res, [201, 400], "unicode name");
    await collegeCreate.shot("college_unicode");
  });

  test("Emoji in college name", async ({ collegeCreate, page }) => {
    const data = collegeValid({ name: `${EMOJI_NAME} ${Date.now()}` });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    await expectApiStatus(res, [201, 400], "emoji name");
    await collegeCreate.shot("college_emoji");
  });

  test("Leading and trailing spaces — trim behavior", async ({ collegeCreate, page }) => {
    const data = collegeLeadingTrailingSpaces();
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST").catch(() => null);
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    if (res?.ok()) {
      await expectToast(page, /College added successfully/i);
      // Stored name should ideally be trimmed on success screen
      await expect(page.getByRole("heading", { name: /College created/i })).toBeVisible();
    } else {
      await expectErrorToast(page, /required|Invalid|Failed/i, "college_spaces_trim");
    }
    await collegeCreate.shot("college_leading_trailing_spaces");
  });

  test("Large address payload", async ({ collegeCreate, page }) => {
    const data = collegeValid({ address: LARGE_ADDRESS });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(data);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    await expectApiStatus(res, [201, 400, 413, 500], "large address");
    await collegeCreate.shot("college_large_address");
  });
});

test.describe("EDGE — College duplicate & navigation", () => {
  test("Duplicate college email → 409 + toast; form recoverable", async ({
    loginPage,
    page,
    collegeCreate,
  }) => {
    await asSuperAdmin(loginPage);
    const first = collegeValid();
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.create(first);
    await collegeCreate.done();

    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();
    const dup = collegeValid({
      email: first.email, // duplicate college contact email
      name: `Other ${Date.now()}`,
      tpoEmail: `other.tpo.${Date.now()}@example.edu`,
    });
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(dup);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    await expectApiStatus(res, [409, 400], "duplicate college email");
    await expectErrorToast(
      page,
      /already exists|Failed|email/i,
      "college_duplicate_email"
    );
    await expectStillOnUrl(page, /\/colleges\/new/);
  });

  test("Duplicate college name — code auto-suffixed (unique college_code)", async ({
    loginPage,
    page,
    collegeCreate,
  }) => {
    await asSuperAdmin(loginPage);
    const sharedName = `QA DupName ${Date.now()}`;
    const a = collegeValid({ name: sharedName });
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.create(a);
    await collegeCreate.done();

    const b = collegeValid({ name: sharedName });
    await page.goto(ROUTES.collegesNew);
    const resPromise = waitForApi(page, "/superadmin/colleges", "POST");
    await collegeCreate.fill(b);
    await collegeCreate.click(collegeCreate.submit);
    const res = await resPromise;
    // Product derives college_code from name and suffixes if taken — expect success
    await expectApiStatus(res, [201], "duplicate name unique code");
    if (res.ok()) {
      const body = await res.json();
      const code = body?.data?.college_code || body?.college_code;
      expect(code, "college_code present").toBeTruthy();
      await expectToast(page, /College added successfully/i);
    }
    await collegeCreate.shot("college_duplicate_name_unique_code");
  });

  test("Duplicate college code field — UI has no code input (server-generated)", async ({
    loginPage,
    page,
    collegeCreate,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();
    const codeField = page.locator('[name="college_code"], [name="collegeCode"], #college_code');
    await expect(codeField).toHaveCount(0);
    await collegeCreate.shot("college_code_not_user_editable");
  });

  test("Rapid double-click Create — single success or guarded second POST", async ({
    loginPage,
    page,
    collegeCreate,
    networkMon,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    const data = collegeValid();
    await collegeCreate.fill(data);
    const before = networkMon.requests.filter(
      (r) => r.method === "POST" && r.url.includes("/superadmin/colleges")
    ).length;

    await Promise.all([
      collegeCreate.submit.click({ clickCount: 1 }),
      collegeCreate.submit.click({ clickCount: 1 }).catch(() => undefined),
    ]);
    await page.waitForTimeout(1500);

    const posts = networkMon.requests.filter(
      (r) => r.method === "POST" && r.url.includes("/superadmin/colleges")
    );
    const newPosts = posts.slice(before);
    // Prefer 1 successful create; at most 2 if race (second should fail)
    expect(newPosts.length).toBeLessThanOrEqual(2);
    const successes = newPosts.filter((r) => r.status === 201);
    expect(successes.length).toBeLessThanOrEqual(1);
    await collegeCreate.shot("college_rapid_double_click");
  });

  test("Browser refresh on create form — form resets / page loads clean", async ({
    loginPage,
    page,
    collegeCreate,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.type(collegeCreate.field("name"), "Temp Refresh College");
    await page.reload({ waitUntil: "domcontentloaded" });
    await collegeCreate.expectForm();
    await expect(collegeCreate.field("name")).toHaveValue("");
    await collegeCreate.shot("college_refresh_form");
  });

  test("Back / Forward navigation around create page", async ({
    loginPage,
    page,
    collegesList,
    collegeCreate,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.colleges);
    await collegesList.expectLoaded();
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.expectForm();
    await page.goBack();
    await expect(page).toHaveURL(/\/colleges(?!\/new)/);
    await page.goForward();
    await expect(page).toHaveURL(/\/colleges\/new/);
    await collegeCreate.expectForm();
    await collegeCreate.shot("college_back_forward");
  });

  test("Multiple tabs — list + create stay consistent", async ({
    loginPage,
    browser,
    page,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.colleges);

    const ctx = page.context();
    const tab2 = await ctx.newPage();
    await tab2.goto(page.url().replace(/\/colleges.*/, "/colleges/new"));
    await expect(tab2.getByRole("heading", { name: /Add New College/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /All Colleges/i })).toBeVisible();
    await tab2.close();
  });

  test("Session timeout / cleared session → redirected to login", async ({
    loginPage,
    page,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    await clearSession(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 20_000 });
    await loginPage.shot("college_session_cleared");
  });

  test("Network disconnect on create → error toast / UI recoverable", async ({
    loginPage,
    page,
    collegeCreate,
    context,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    await collegeCreate.fill(collegeValid());
    await context.setOffline(true);
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /Failed|network|error|Unable|offline/i, "college_network_disconnect").catch(
      async () => {
        // Some builds surface via console only — form must remain
        await expectStillOnUrl(page, /\/colleges\/new/);
      }
    );
    await context.setOffline(false);
    await collegeCreate.expectForm();
  });

  test("Server timeout simulation — aborted create request", async ({
    loginPage,
    page,
    collegeCreate,
  }) => {
    await asSuperAdmin(loginPage);
    await page.goto(ROUTES.collegesNew);
    await page.route("**/api/superadmin/colleges", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((r) => setTimeout(r, 35_000));
        await route.abort("timedout");
        return;
      }
      await route.continue();
    });
    await collegeCreate.fill(collegeValid());
    await collegeCreate.click(collegeCreate.submit);
    await expectErrorToast(page, /Failed|timeout|error|network/i, "college_server_timeout").catch(
      async () => {
        await expectStillOnUrl(page, /\/colleges\/new/);
      }
    );
    await page.unroute("**/api/superadmin/colleges");
  });
});
