import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";
import { AuthPayload, UserRole } from "../types/index.js";
import { logPermissionDenied } from "../services/audit.service.js";
import { queryOne } from "../config/database.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Verify JWT access token and attach user payload to request.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload & { purpose?: string };

    // Reject non-access tokens (e.g. the 2FA login-challenge token, which also
    // carries a userId). Only true access tokens omit the `purpose` claim.
    if (payload.purpose) {
      return next(new AppError("Invalid or expired token", 401));
    }

    // Verify user still exists in DB (guards against stale tokens after re-seeds or account deletion)
    const exists = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 AND is_active = TRUE",
      [payload.userId]
    );
    if (!exists) {
      return next(new AppError("Session expired. Please log in again.", 401));
    }

    req.user = payload;
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
};

/**
 * Role aliases: legacy DB values map to canonical RBAC roles.
 */
const ROLE_ALIASES: Record<string, UserRole> = {
  admin: "super_admin",
  college: "college_admin",
};

/**
 * Restrict access to specific roles.
 * Accepts both legacy role names and new RBAC names.
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    // Normalise to lowercase so Prisma UPPER_CASE enum values ("HR", "SUPER_ADMIN")
    // are handled the same as the lowercase canonical roles used in route guards.
    const raw = req.user.role.toLowerCase() as UserRole;
    const effective = ROLE_ALIASES[raw] ?? raw;

    // Also expand the allowed list so authorize("admin") still matches super_admin
    const expanded = new Set<string>(roles);
    for (const r of roles) {
      const alias = ROLE_ALIASES[r];
      if (alias) expanded.add(alias);
    }
    // And reverse: if the route says "super_admin", also accept legacy "admin"
    for (const [legacy, canonical] of Object.entries(ROLE_ALIASES)) {
      if (expanded.has(canonical)) expanded.add(legacy);
    }

    if (!expanded.has(effective)) {
      logPermissionDenied(req).catch(() => { });
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
};

/**
 * Verify AI Engine service API key (x-api-key header).
 * Used for machine-to-machine calls from the AI engine.
 */
export const authenticateService = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey !== env.AI_ENGINE_API_KEY) {
    return next(new AppError("Invalid service API key", 401));
  }
  next();
};

/**
 * CxO read-only guard: blocks POST/PUT/PATCH/DELETE for CxO users.
 * Apply AFTER authenticate on routes where CxO has read access but
 * write access is available to other roles on the same endpoint group.
 */
export const enforceCxoReadOnly = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) return next();

  const raw = req.user.role.toLowerCase();
  const effective = ROLE_ALIASES[raw] ?? raw;

  if (effective === "cxo" && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    logPermissionDenied(req).catch(() => { });
    return next(new AppError("CxO role has read-only access", 403));
  }
  next();
};
