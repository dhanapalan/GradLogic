import { Page, Locator, expect } from "@playwright/test";
import { highlightClick } from "../utils/interactions";

/** Shared ConfirmModal (superadmin ConfirmModal.tsx). */
export class ConfirmModal {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly cancelBtn: Locator;
  readonly closeBtn: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
    this.title = page.locator("#confirm-modal-title");
    this.message = page.locator("#confirm-modal-message");
    this.cancelBtn = this.dialog.getByRole("button", { name: "Cancel" });
    this.closeBtn = this.dialog.getByRole("button", { name: "Close" });
  }

  async expectOpen(title?: string | RegExp): Promise<void> {
    await expect(this.dialog).toBeVisible();
    if (title) await expect(this.title).toHaveText(title);
  }

  async cancel(): Promise<void> {
    await highlightClick(this.cancelBtn);
    await expect(this.dialog).toBeHidden();
  }

  async confirm(label: string | RegExp): Promise<void> {
    await highlightClick(this.dialog.getByRole("button", { name: label }));
  }
}
