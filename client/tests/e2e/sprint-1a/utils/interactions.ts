import { Page, Locator, expect } from "@playwright/test";

/** Soft highlight of the element about to be interacted with (visual QA aid). */
export async function highlight(locator: Locator): Promise<void> {
  await locator.evaluate((el) => {
    const prev = (el as HTMLElement).style.outline;
    const prevOffset = (el as HTMLElement).style.outlineOffset;
    (el as HTMLElement).style.outline = "3px solid #f59e0b";
    (el as HTMLElement).style.outlineOffset = "2px";
    (el as HTMLElement).dataset.qaHighlight = "1";
    setTimeout(() => {
      (el as HTMLElement).style.outline = prev;
      (el as HTMLElement).style.outlineOffset = prevOffset;
      delete (el as HTMLElement).dataset.qaHighlight;
    }, 600);
  }).catch(() => {
    /* element may detach — ignore */
  });
}

/** Click with highlight. */
export async function highlightClick(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await highlight(locator);
  await locator.click();
}

/**
 * Type text naturally (character-by-character) for headed demos / recording.
 * Falls back to fill for password fields when NATURAL_TYPE=0.
 */
export async function naturalType(
  locator: Locator,
  text: string,
  options?: { delayMs?: number; clear?: boolean }
): Promise<void> {
  const delay = options?.delayMs ?? Number(process.env.TYPE_DELAY_MS ?? 40);
  const clear = options?.clear ?? true;
  await locator.waitFor({ state: "visible" });
  await highlight(locator);
  await locator.click();
  if (clear) await locator.fill("");
  if (process.env.NATURAL_TYPE === "0") {
    await locator.fill(text);
    return;
  }
  await locator.pressSequentially(text, { delay });
}

/** Capture a named step screenshot under the test output dir. */
export async function stepScreenshot(page: Page, stepName: string): Promise<void> {
  const safe = stepName.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80);
  await page.screenshot({
    path: `test-results/sprint-1a/steps/${Date.now()}_${safe}.png`,
    fullPage: true,
  });
}
