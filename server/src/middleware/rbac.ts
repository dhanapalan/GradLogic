import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";
import { logPermissionDenied } from "../services/audit.service.js";
import { roleHasAllPermissions, roleHasAnyPermission } from "../services/rbac.service.js";
import type { Permission } from "../constants/permissions.js";

/**
 * Permission-based authorization middleware (RBAC).
 *
 * Use AFTER `authenticate`. Resolves the caller's role → permission set
 * (DB-backed with code fallback) and checks it against the required list.
 *
 * `requirePermission(a, b)`      → caller must have ALL of a AND b.
 * `requireAnyPermission(a, b)`   → caller must have a OR b.
 *
 * super_admin bypasses all checks (handled inside rbac.service).
 */
export function requirePermission(...permissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new AppError("Authentication required", 401));
    try {
      const ok = await roleHasAllPermissions(req.user.role, permissions);
      if (!ok) {
        logPermissionDenied(req).catch(() => {});
        return next(new AppError("Insufficient permissions", 403));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new AppError("Authentication required", 401));
    try {
      const ok = await roleHasAnyPermission(req.user.role, permissions);
      if (!ok) {
        logPermissionDenied(req).catch(() => {});
        return next(new AppError("Insufficient permissions", 403));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
