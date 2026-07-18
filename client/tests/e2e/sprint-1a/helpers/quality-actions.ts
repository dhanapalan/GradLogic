/**
 * Lightweight helpers for specs that measure named business timings.
 * Reuses PerformanceCollector from the diagnostics fixture.
 */
import type { Page } from "@playwright/test";
import { getDiagnostics } from "../diagnostics/context";
import { QUALITY } from "../config/quality.config";
import { waitAndValidateApi, type ApiValidationOptions } from "../utils/api-validator";

export async function measureLogin<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  const d = getDiagnostics(page);
  await d?.shots.capture(page, "before-login");
  const result = d
    ? await d.perf.measure("login", fn, QUALITY.loginBudgetMs)
    : await fn();
  await d?.shots.capture(page, "after-login");
  return result;
}

export async function measureNavigation<T>(
  page: Page,
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const d = getDiagnostics(page);
  const result = d ? await d.perf.measure(`nav:${name}`, fn, QUALITY.slowPageMs) : await fn();
  await d?.shots.capture(page, "after-navigation", name);
  return result;
}

export async function measureSave<T>(page: Page, name: string, fn: () => Promise<T>): Promise<T> {
  const d = getDiagnostics(page);
  await d?.shots.capture(page, "before-save", name);
  const result = d ? await d.perf.measure(`save:${name}`, fn) : await fn();
  await d?.shots.capture(page, "after-save", name);
  return result;
}

export async function measureLogout<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  const d = getDiagnostics(page);
  await d?.shots.capture(page, "before-logout");
  return d ? d.perf.measure("logout", fn) : fn();
}

export async function measureApi(
  page: Page,
  name: string,
  pathIncludes: string,
  method: string,
  options?: ApiValidationOptions
): Promise<unknown> {
  const d = getDiagnostics(page);
  const run = () => waitAndValidateApi(page, pathIncludes, method, options);
  return d ? d.perf.measure(`api:${name}`, run, options?.maxMs ?? QUALITY.slowApiMs) : run();
}
