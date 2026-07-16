import { env } from "./env.js";

/** Always-allowed production portal origins (in case .env CLIENT_URLS is incomplete). */
const PRODUCTION_ORIGINS = [
  "https://gradlogic.atherasys.com",
  "https://www.gradlogic.atherasys.com",
  "https://admin.gradlogic.atherasys.com",
  "https://campus.gradlogic.atherasys.com",
  "https://exam.gradlogic.atherasys.com",
] as const;

function isAtherasysPortalOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host === "gradlogic.atherasys.com" || host.endsWith(".gradlogic.atherasys.com");
  } catch {
    return false;
  }
}

/** Origins Socket.IO / Express CORS should accept. */
export function allowedCorsOrigins(): string[] {
  return Array.from(new Set([...env.CLIENT_URLS, ...PRODUCTION_ORIGINS]));
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (env.CLIENT_URLS.includes(origin)) return true;
  if ((PRODUCTION_ORIGINS as readonly string[]).includes(origin)) return true;
  if (env.NODE_ENV === "production" && isAtherasysPortalOrigin(origin)) return true;
  return false;
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean | string) => void
): void {
  if (isAllowedCorsOrigin(origin)) {
    // Reflect the request origin when present (required for credentials).
    callback(null, origin || true);
    return;
  }
  callback(null, false);
}
