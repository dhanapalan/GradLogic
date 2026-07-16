import { Request } from "express";
import { AppError } from "./errorHandler.js";
import { queryOne } from "../config/database.js";

const COLLEGE_SCOPED_ROLES = new Set([
  "college_admin",
  "college",
  "college_staff",
  "tpo",
  "placement_cell",
]);

export function isCollegeScopedRole(role?: string): boolean {
  return COLLEGE_SCOPED_ROLES.has((role || "").toLowerCase());
}

/**
 * Resolve the caller's college_id for college-scoped roles.
 * Platform admins return null (no forced scope).
 */
export async function resolveCallerCollegeId(req: Request): Promise<string | null> {
  const user = req.user;
  if (!user) throw new AppError("Unauthorized", 401);
  if (!isCollegeScopedRole(user.role)) return null;

  if (user.college_id) return user.college_id;

  const row = await queryOne<{ id: string }>(
    `SELECT id FROM colleges WHERE legacy_user_id = $1 AND deleted_at IS NULL`,
    [user.userId],
  );
  if (row?.id) return row.id;

  throw new AppError("Unauthorized: College context missing", 403);
}

/**
 * For college-scoped roles, ignore client-supplied college_id and force JWT college.
 * For platform admins, allow optional client college_id.
 */
export async function effectiveCollegeId(
  req: Request,
  clientCollegeId?: string | null,
): Promise<string | null> {
  const scoped = await resolveCallerCollegeId(req);
  if (scoped) return scoped;
  return clientCollegeId || null;
}

export function assertSameCollege(callerCollegeId: string, resourceCollegeId: string | null | undefined) {
  if (!resourceCollegeId || resourceCollegeId !== callerCollegeId) {
    throw new AppError("Not authorized to access this resource", 403);
  }
}
