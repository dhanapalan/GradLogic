/**
 * API response validation helpers (headers, auth, payload, status, timing, schema, rules).
 */
import { APIResponse, expect, Page, Response } from "@playwright/test";
import { QUALITY } from "../config/quality.config";
import type { NetworkMonitor } from "./monitors";

export type JsonSchemaShape = Record<string, "string" | "number" | "boolean" | "object" | "array" | "any">;

export type ApiValidationOptions = {
  /** Expected HTTP status (single or list). */
  status?: number | number[];
  /** Max response time in ms. */
  maxMs?: number;
  /** Require Authorization on the *request* (observed via Playwright request headers). */
  requireAuthHeader?: boolean;
  /** Required response header names (case-insensitive). */
  responseHeaders?: string[];
  /** Required top-level JSON keys / types. */
  schema?: JsonSchemaShape;
  /** Business-rule predicates over parsed JSON body. */
  rules?: Array<(body: unknown) => string | null>;
  /** Substring that must appear in Content-Type. */
  contentTypeIncludes?: string;
};

function statusOk(actual: number, expected?: number | number[]): boolean {
  if (expected === undefined) return actual >= 200 && actual < 300;
  const list = Array.isArray(expected) ? expected : [expected];
  return list.includes(actual);
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function assertJsonSchema(body: unknown, schema: JsonSchemaShape, path = "$"): void {
  if (typeof body !== "object" || body === null) {
    throw new Error(`[ApiValidator] Expected object at ${path}`);
  }
  const obj = body as Record<string, unknown>;
  for (const [key, expected] of Object.entries(schema)) {
    if (!(key in obj)) {
      throw new Error(`[ApiValidator] Missing key ${path}.${key}`);
    }
    if (expected === "any") continue;
    const actual = typeOf(obj[key]);
    if (actual !== expected) {
      throw new Error(
        `[ApiValidator] ${path}.${key} expected ${expected}, got ${actual}`
      );
    }
  }
}

/** Validate a Playwright Response (page network) or APIResponse (request fixture). */
export async function validateApiResponse(
  res: Response | APIResponse,
  options: ApiValidationOptions = {}
): Promise<unknown> {
  const status = res.status();
  if (!statusOk(status, options.status)) {
    const expected = options.status ?? "2xx";
    throw new Error(`[ApiValidator] Status ${status}, expected ${expected} (${res.url()})`);
  }

  const headers =
    typeof (res as Response).headers === "function"
      ? (res as Response).headers()
      : (res as APIResponse).headers();

  if (options.responseHeaders) {
    const lower = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    for (const h of options.responseHeaders) {
      if (!(h.toLowerCase() in lower)) {
        throw new Error(`[ApiValidator] Missing response header: ${h}`);
      }
    }
  }

  if (options.contentTypeIncludes) {
    const ct = headers["content-type"] || headers["Content-Type"] || "";
    expect(ct.toLowerCase()).toContain(options.contentTypeIncludes.toLowerCase());
  }

  if (options.requireAuthHeader && "request" in res) {
    const reqHeaders = (res as Response).request().headers();
    const auth = reqHeaders["authorization"] || reqHeaders["Authorization"];
    if (!auth) {
      throw new Error(`[ApiValidator] Missing Authorization on request ${res.url()}`);
    }
  }

  let body: unknown = undefined;
  const ct = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  if (ct.includes("json")) {
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
  }

  if (options.schema && body !== undefined) {
    // Prefer data envelope when present
    const root =
      body && typeof body === "object" && "data" in (body as object)
        ? (body as { data: unknown }).data ?? body
        : body;
    assertJsonSchema(root, options.schema);
  }

  if (options.rules && body !== undefined) {
    for (const rule of options.rules) {
      const msg = rule(body);
      if (msg) throw new Error(`[ApiValidator] Business rule failed: ${msg}`);
    }
  }

  return body;
}

/** Wait for an API call and validate it. */
export async function waitAndValidateApi(
  page: Page,
  pathIncludes: string,
  method: string,
  options: ApiValidationOptions = {},
  timeout = 45_000
): Promise<unknown> {
  const start = Date.now();
  const res = await page.waitForResponse(
    (r) =>
      r.url().includes(pathIncludes) &&
      r.request().method().toUpperCase() === method.toUpperCase(),
    { timeout }
  );
  const elapsed = Date.now() - start;
  const maxMs = options.maxMs ?? QUALITY.slowApiMs;
  if (elapsed > maxMs && !QUALITY.softSlowApi) {
    throw new Error(
      `[ApiValidator] ${method} ${pathIncludes} took ${elapsed}ms > ${maxMs}ms`
    );
  }
  return validateApiResponse(res, options);
}

/** Assert last observed network entry meets status/timing budgets. */
export function assertLastApi(
  networkMon: NetworkMonitor,
  pathIncludes: string,
  method: string,
  options: { status?: number | number[]; maxMs?: number } = {}
): void {
  const hit = networkMon.findLast(pathIncludes, method);
  if (!hit) throw new Error(`[ApiValidator] No ${method} ${pathIncludes} in network log`);
  if (hit.failure) throw new Error(`[ApiValidator] ${pathIncludes} failed: ${hit.failure}`);
  if (hit.status !== undefined && !statusOk(hit.status, options.status)) {
    throw new Error(`[ApiValidator] ${pathIncludes} → ${hit.status}`);
  }
  const maxMs = options.maxMs ?? QUALITY.slowApiMs;
  if (hit.timingMs !== undefined && hit.timingMs > maxMs && !QUALITY.softSlowApi) {
    throw new Error(`[ApiValidator] ${pathIncludes} slow: ${hit.timingMs}ms`);
  }
}
