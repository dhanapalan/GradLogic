import { Page, expect } from "@playwright/test";
import { ConsoleMonitor, NetworkMonitor } from "../utils/monitors";
import { validateStep, waitForSpinnerGone, type StepValidationOptions } from "../utils/assertions";
import { highlightClick, naturalType, stepScreenshot } from "../utils/interactions";
import { getDiagnostics } from "../diagnostics/context";
import type { LifecycleMoment } from "../utils/lifecycle-screenshots";

/**
 * Base Page Object — shared navigation, validation, and interaction helpers.
 * When Sprint 1A diagnostics are bound, actions are step-logged automatically.
 */
export abstract class BasePage {
  constructor(
    readonly page: Page,
    protected readonly consoleMon: ConsoleMonitor,
    protected readonly networkMon: NetworkMonitor
  ) {}

  abstract readonly path: string;
  abstract readonly heading: string | RegExp;

  protected diag() {
    return getDiagnostics(this.page);
  }

  async goto(): Promise<void> {
    const d = this.diag();
    const run = async () => {
      await this.page.goto(this.path, { waitUntil: "domcontentloaded" });
      await waitForSpinnerGone(this.page);
      await d?.shots.capture(this.page, "after-navigation", this.path);
    };
    if (d) {
      await d.logger.step(`goto ${this.path}`, `URL contains ${this.path}`, async () => {
        const { QUALITY } = await import("../config/quality.config");
        await d.perf.measure(`page.load:${this.path}`, run, QUALITY.slowPageMs);
      });
    } else {
      await run();
    }
  }

  async validate(opts: Omit<StepValidationOptions, "heading"> & { heading?: string | RegExp } = {}): Promise<void> {
    const d = this.diag();
    const run = async () => {
      await validateStep(this.page, this.consoleMon, this.networkMon, {
        urlIncludes: opts.urlIncludes ?? this.path,
        heading: opts.heading ?? this.heading,
        ...opts,
      });
    };
    if (d) {
      await d.logger.step(
        `validate ${this.path}`,
        String(opts.heading ?? this.heading),
        run
      );
    } else {
      await run();
    }
  }

  async click(locator: Parameters<typeof highlightClick>[0]): Promise<void> {
    const d = this.diag();
    if (d) {
      await d.logger.step("click", "element clicked", async () => highlightClick(locator));
    } else {
      await highlightClick(locator);
    }
  }

  async type(locator: Parameters<typeof naturalType>[0], text: string): Promise<void> {
    const d = this.diag();
    if (d) {
      await d.logger.step("type", "text entered", async () => naturalType(locator, text));
    } else {
      await naturalType(locator, text);
    }
  }

  async shot(label: string, moment: LifecycleMoment = "custom"): Promise<void> {
    const d = this.diag();
    if (d) {
      await d.shots.capture(this.page, moment, label);
    }
    await stepScreenshot(this.page, label);
  }

  async lifecycle(moment: LifecycleMoment, label?: string): Promise<void> {
    await this.diag()?.shots.capture(this.page, moment, label);
  }

  async expectNoJsErrors(context: string): Promise<void> {
    await this.consoleMon.syncUnhandledFromPage().catch(() => undefined);
    this.consoleMon.assertClean(context);
  }

  async waitLoaded(): Promise<void> {
    await expect(this.page.locator("body")).toBeVisible();
    await waitForSpinnerGone(this.page);
  }
}
