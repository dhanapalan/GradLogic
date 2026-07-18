/**
 * Lifecycle screenshots — before/after login, nav, save, logout, failure.
 */
import fs from "node:fs";
import path from "node:path";
import { Page, TestInfo } from "@playwright/test";
import { QUALITY } from "../config/quality.config";

export type LifecycleMoment =
  | "before-login"
  | "after-login"
  | "after-navigation"
  | "before-save"
  | "after-save"
  | "before-logout"
  | "on-failure"
  | "custom";

export class LifecycleScreenshots {
  readonly paths: { moment: LifecycleMoment; file: string; label: string }[] = [];
  private readonly dir: string;

  constructor(private readonly testInfo: TestInfo) {
    this.dir = path.join("test-results", "sprint-1a", "lifecycle", this.safeId());
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private safeId(): string {
    return this.testInfo.titlePath
      .join("_")
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .slice(0, 120);
  }

  async capture(page: Page, moment: LifecycleMoment, label?: string): Promise<string | null> {
    if (!QUALITY.lifecycleScreenshots && moment !== "on-failure") return null;
    const name = `${String(this.paths.length + 1).padStart(2, "0")}_${moment}_${(label || "shot")
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .slice(0, 60)}.png`;
    const file = path.join(this.dir, name);
    try {
      await page.screenshot({ path: file, fullPage: true });
      this.paths.push({ moment, file, label: label || moment });
      await this.testInfo.attach(`screenshot:${moment}`, {
        path: file,
        contentType: "image/png",
      });
      return file;
    } catch {
      return null;
    }
  }
}
