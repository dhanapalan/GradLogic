import { Request, Response } from "express";
import { env } from "../config/env.js";

// httpOnly refresh-token cookie: keeps the long-lived credential out of
// JS-readable storage (localStorage/sessionStorage) so XSS/DevTools can't
// read it. Web clients rely on this; mobile clients keep using the body
// `refreshToken` field.
export const REFRESH_COOKIE = "ts_refresh";

// Scoped to /api so it rides along on /api/auth/* and /api/sessions but is
// never sent to static assets.
const COOKIE_PATH = "/api";

const baseOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: COOKIE_PATH,
};

/** Read the refresh token cookie without requiring cookie-parser. */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== REFRESH_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/**
 * Set the refresh cookie. `persistent` mirrors the client's Remember Me:
 * persistent cookies survive browser restarts (maxAge = refresh TTL);
 * otherwise it's a session cookie that dies with the browser.
 */
export function setRefreshCookie(res: Response, token: string, persistent: boolean): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions,
    ...(persistent
      ? { maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000 }
      : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}
