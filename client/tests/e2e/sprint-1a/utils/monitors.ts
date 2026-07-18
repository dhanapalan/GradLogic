import { Page, ConsoleMessage, Request, Response } from "@playwright/test";
import { QUALITY } from "../config/quality.config";

export type ConsoleEntry = {
  type: string;
  text: string;
  location?: string;
  category?: "console" | "pageerror" | "unhandledrejection" | "framework";
};

export type NetworkEntry = {
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  failure?: string;
  timingMs?: number;
  resourceType?: string;
  cancelled?: boolean;
  timedOut?: boolean;
  retryOf?: boolean;
};

function isIgnored(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

function isFrameworkError(text: string): boolean {
  return (
    /react(?:\.| )/i.test(text) ||
    /Minified React error/i.test(text) ||
    /vue(?:\.| )/i.test(text) ||
    /\[Vue warn\]/i.test(text) ||
    /angular(?:\.| )/i.test(text) ||
    /NG\d{4}/i.test(text) ||
    /Unhandled (?:Promise )?Rejection/i.test(text) ||
    /ChunkLoadError/i.test(text)
  );
}

/**
 * Captures console + page errors + unhandled rejections for the life of the page.
 * Configurable ignore list via QUALITY.consoleIgnore / S1A_CONSOLE_IGNORE.
 */
export class ConsoleMonitor {
  readonly entries: ConsoleEntry[] = [];
  readonly pageErrors: string[] = [];
  readonly unhandledRejections: string[] = [];
  private attached = false;
  private extraIgnore: RegExp[] = [];

  constructor(private readonly page: Page) {}

  /** Add known-warning exclusions for a single test. */
  ignore(...patterns: (string | RegExp)[]): void {
    for (const p of patterns) {
      this.extraIgnore.push(typeof p === "string" ? new RegExp(p, "i") : p);
    }
  }

  private allIgnore(): RegExp[] {
    return [...QUALITY.consoleIgnore, ...this.extraIgnore];
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;

    this.page.on("console", (msg: ConsoleMessage) => {
      const text = msg.text();
      if (isIgnored(text, this.allIgnore())) return;
      const category: ConsoleEntry["category"] = isFrameworkError(text)
        ? "framework"
        : "console";
      this.entries.push({
        type: msg.type(),
        text,
        location: msg.location()?.url,
        category,
      });
    });

    this.page.on("pageerror", (err: Error) => {
      const text = err.message || String(err);
      if (isIgnored(text, this.allIgnore())) return;
      this.pageErrors.push(text);
      this.entries.push({
        type: "error",
        text,
        category: isFrameworkError(text) ? "framework" : "pageerror",
      });
    });

    // Inject unhandledrejection listener as early as possible
    this.page.addInitScript(() => {
      const w = window as unknown as {
        __s1aUnhandled?: string[];
      };
      w.__s1aUnhandled = w.__s1aUnhandled || [];
      window.addEventListener("unhandledrejection", (ev) => {
        const reason =
          ev.reason instanceof Error
            ? ev.reason.message
            : typeof ev.reason === "string"
              ? ev.reason
              : JSON.stringify(ev.reason);
        w.__s1aUnhandled!.push(reason);
        // Also surface in console for monitor capture
        console.error(`[Unhandled Promise Rejection] ${reason}`);
      });
    });
  }

  /** Drain page-injected unhandled rejections into this monitor. */
  async syncUnhandledFromPage(): Promise<void> {
    const list = await this.page
      .evaluate(() => {
        const w = window as unknown as { __s1aUnhandled?: string[] };
        const out = [...(w.__s1aUnhandled || [])];
        w.__s1aUnhandled = [];
        return out;
      })
      .catch(() => [] as string[]);
    for (const text of list) {
      if (isIgnored(text, this.allIgnore())) continue;
      this.unhandledRejections.push(text);
      this.entries.push({
        type: "error",
        text,
        category: "unhandledrejection",
      });
    }
  }

  errors(): ConsoleEntry[] {
    return this.entries.filter(
      (e) => e.type === "error" || e.category === "pageerror" || e.category === "unhandledrejection"
    );
  }

  frameworkErrors(): ConsoleEntry[] {
    return this.entries.filter((e) => e.category === "framework");
  }

  assertClean(context = "page"): void {
    if (!QUALITY.failOnConsoleErrors) return;
    const ignore = this.allIgnore();
    const js = this.pageErrors.filter((m) => !isIgnored(m, ignore));
    const rejections = this.unhandledRejections.filter((m) => !isIgnored(m, ignore));
    const cons = this.errors().filter((e) => !isIgnored(e.text, ignore));
    const framework = this.frameworkErrors().filter((e) => !isIgnored(e.text, ignore));

    if (js.length || rejections.length || cons.length || framework.length) {
      const detail = [
        ...js.map((m) => `JS Exception: ${m}`),
        ...rejections.map((m) => `Unhandled Promise: ${m}`),
        ...framework.map((e) => `Framework (${e.category}): ${e.text}`),
        ...cons
          .filter((e) => e.category === "console")
          .map((e) => `console.${e.type}: ${e.text}`),
      ].join("\n");
      throw new Error(`[ConsoleMonitor] Unexpected errors after ${context}:\n${detail}`);
    }
  }

  summary(): { errors: number; pageErrors: number; unhandled: number; framework: number } {
    return {
      errors: this.errors().length,
      pageErrors: this.pageErrors.length,
      unhandled: this.unhandledRejections.length,
      framework: this.frameworkErrors().length,
    };
  }
}

/**
 * Records network traffic with failure classification, retries, and slow detection.
 */
export class NetworkMonitor {
  readonly requests: NetworkEntry[] = [];
  private attached = false;
  private readonly pending = new Map<Request, number>();
  private readonly seenKeys = new Map<string, number>();
  private extraAllow: RegExp[] = [];

  constructor(private readonly page: Page) {}

  allowFailure(...patterns: (string | RegExp)[]): void {
    for (const p of patterns) {
      this.extraAllow.push(typeof p === "string" ? new RegExp(p, "i") : p);
    }
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;

    this.page.on("request", (req: Request) => {
      this.pending.set(req, Date.now());
      const key = `${req.method()} ${req.url()}`;
      const prev = this.seenKeys.get(key) || 0;
      this.seenKeys.set(key, prev + 1);
    });

    this.page.on("response", (res: Response) => {
      const req = res.request();
      const started = this.pending.get(req);
      this.pending.delete(req);
      const key = `${req.method()} ${req.url()}`;
      const count = this.seenKeys.get(key) || 1;
      this.requests.push({
        method: req.method(),
        url: res.url(),
        status: res.status(),
        ok: res.ok(),
        timingMs: started ? Date.now() - started : undefined,
        resourceType: req.resourceType(),
        retryOf: count > 1,
      });
    });

    this.page.on("requestfailed", (req: Request) => {
      const started = this.pending.get(req);
      this.pending.delete(req);
      const failure = req.failure()?.errorText || "failed";
      const cancelled = /cancel|aborted/i.test(failure);
      const timedOut = /timeout|timedout|TIMED_OUT/i.test(failure);
      this.requests.push({
        method: req.method(),
        url: req.url(),
        failure,
        cancelled,
        timedOut,
        timingMs: started ? Date.now() - started : undefined,
        resourceType: req.resourceType(),
      });
    });
  }

  findLast(pathSubstring: string, method?: string): NetworkEntry | undefined {
    for (let i = this.requests.length - 1; i >= 0; i--) {
      const r = this.requests[i];
      if (!r.url.includes(pathSubstring)) continue;
      if (method && r.method.toUpperCase() !== method.toUpperCase()) continue;
      return r;
    }
    return undefined;
  }

  assertApiSuccess(pathSubstring: string, method = "GET"): NetworkEntry {
    const hit = this.findLast(pathSubstring, method);
    if (!hit) {
      throw new Error(`[NetworkMonitor] No ${method} …${pathSubstring} observed`);
    }
    if (hit.failure) {
      throw new Error(`[NetworkMonitor] ${method} ${pathSubstring} failed: ${hit.failure}`);
    }
    if (hit.status && hit.status >= 400) {
      throw new Error(
        `[NetworkMonitor] ${method} ${pathSubstring} → HTTP ${hit.status}`
      );
    }
    return hit;
  }

  private isAllowed(url: string): boolean {
    const all = [...QUALITY.networkAllowFailures, ...this.extraAllow];
    return all.some((re) => re.test(url));
  }

  private isExpected4xx(url: string): boolean {
    return QUALITY.api4xxAllow.some((re) => re.test(url));
  }

  failedRequests(): NetworkEntry[] {
    return this.requests.filter((r) => !!r.failure && !this.isAllowed(r.url));
  }

  http4xx(): NetworkEntry[] {
    return this.requests.filter(
      (r) =>
        typeof r.status === "number" &&
        r.status >= 400 &&
        r.status < 500 &&
        /\/api\//i.test(r.url) &&
        !this.isAllowed(r.url) &&
        !this.isExpected4xx(r.url)
    );
  }

  http5xx(): NetworkEntry[] {
    return this.requests.filter(
      (r) =>
        typeof r.status === "number" &&
        r.status >= 500 &&
        !this.isAllowed(r.url)
    );
  }

  timeouts(): NetworkEntry[] {
    return this.requests.filter((r) => r.timedOut && !this.isAllowed(r.url));
  }

  cancelled(): NetworkEntry[] {
    return this.requests.filter((r) => r.cancelled && !this.isAllowed(r.url));
  }

  retries(): NetworkEntry[] {
    return this.requests.filter((r) => r.retryOf);
  }

  slowResponses(thresholdMs = QUALITY.slowApiMs): NetworkEntry[] {
    return this.requests.filter(
      (r) =>
        /\/api\//i.test(r.url) &&
        typeof r.timingMs === "number" &&
        r.timingMs > thresholdMs
    );
  }

  /**
   * Fail the test on unexpected network instability.
   * Soft-warns (throws only when QUALITY.failOnNetworkErrors) for 5xx/timeouts/failures.
   */
  assertStable(context = "page"): void {
    const problems: string[] = [];

    for (const r of this.http5xx()) {
      problems.push(`HTTP ${r.status} ${r.method} ${r.url}`);
    }
    for (const r of this.timeouts()) {
      problems.push(`TIMEOUT ${r.method} ${r.url} (${r.failure})`);
    }
    for (const r of this.failedRequests()) {
      if (r.cancelled) continue; // navigation cancels are common
      problems.push(`FAILED ${r.method} ${r.url} (${r.failure})`);
    }
    if (QUALITY.failOnApi4xx) {
      for (const r of this.http4xx()) {
        problems.push(`HTTP ${r.status} ${r.method} ${r.url}`);
      }
    }

    const slow = this.slowResponses();
    if (slow.length && !QUALITY.softSlowApi) {
      for (const r of slow) {
        problems.push(`SLOW ${r.timingMs}ms ${r.method} ${r.url}`);
      }
    }

    if (problems.length && QUALITY.failOnNetworkErrors) {
      throw new Error(
        `[NetworkMonitor] Unexpected network issues after ${context}:\n${problems.join("\n")}`
      );
    }
  }

  stabilitySummary() {
    return {
      total: this.requests.length,
      failed: this.failedRequests().length,
      http4xx: this.http4xx().length,
      http5xx: this.http5xx().length,
      timeouts: this.timeouts().length,
      cancelled: this.cancelled().length,
      retries: this.retries().length,
      slow: this.slowResponses().length,
    };
  }

  dump(): string {
    return this.requests
      .map((r) => `${r.method} ${r.status ?? "—"} ${r.timingMs ?? "—"}ms ${r.url}`)
      .join("\n");
  }
}
