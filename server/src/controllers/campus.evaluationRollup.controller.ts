import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import { getCollegeEvaluationRollup } from "../services/collegeEvaluationRollup.service.js";

async function resolveCollegeId(req: Request): Promise<string> {
  const user = req.user;
  if (!user) throw new AppError("Unauthorized", 401);
  if (user.college_id) return user.college_id;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM colleges WHERE legacy_user_id = $1`,
    [user.userId]
  );
  if (row?.id) return row.id;
  throw new AppError("Unauthorized: College context missing", 403);
}

/** Faculty (instructor) accounts only ever see their own department's rollup. */
async function resolveCallerDepartment(req: Request): Promise<string | null> {
  const user = req.user;
  if (!user || user.role !== "instructor") return null;
  const row = await queryOne<{ department: string | null }>(
    `SELECT department FROM users WHERE id = $1`,
    [user.userId]
  );
  return row?.department?.trim() || null;
}

/** GET /api/campus/evaluation/rollup?department=... */
export async function getRollup(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const callerDepartment = await resolveCallerDepartment(req);
    const requested =
      typeof req.query.department === "string" ? req.query.department.trim() : "";
    // Faculty are locked to their own department regardless of query param.
    const department = callerDepartment || requested || null;

    const data = await getCollegeEvaluationRollup(collegeId, department);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
