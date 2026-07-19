import { Request, Response, NextFunction } from "express";
import {
  listActiveSessions,
  revokeAllUserTokens,
  revokeSessionById,
} from "../services/token.service.js";
import { recordAuditEvent } from "../services/adminAudit.service.js";
import { ApiResponse } from "../types/index.js";
import { readRefreshCookie } from "../utils/refreshCookie.js";

function currentRefreshToken(req: Request): string | null {
  const body = (req.body ?? {}) as { refreshToken?: string };
  const header = req.headers["x-refresh-token"];
  if (typeof body.refreshToken === "string" && body.refreshToken) return body.refreshToken;
  if (typeof header === "string" && header) return header;
  // Web clients: the refresh token lives in an httpOnly cookie.
  return readRefreshCookie(req);
}

export async function listSessions(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    // Header / body only — do not accept refresh tokens via query string.
    const refresh = currentRefreshToken(req);
    const data = await listActiveSessions(req.user!.userId, refresh);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const id = String(req.params.id || "");
    await revokeSessionById(req.user!.userId, id);
    recordAuditEvent({
      userId: req.user!.userId,
      action: "SESSION_REVOKED",
      resourceType: "session",
      resourceId: id,
      ipAddress: req.ip,
    }).catch(() => {});
    res.json({ success: true, message: "Session revoked" });
  } catch (err) {
    next(err);
  }
}

export async function revokeAllSessions(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    await revokeAllUserTokens(req.user!.userId);
    recordAuditEvent({
      userId: req.user!.userId,
      action: "SESSIONS_REVOKED_ALL",
      resourceType: "session",
      resourceId: req.user!.userId,
      ipAddress: req.ip,
    }).catch(() => {});
    res.json({ success: true, message: "All sessions revoked" });
  } catch (err) {
    next(err);
  }
}
