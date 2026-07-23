import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as departments from "../services/collegeDepartments.service.js";

function getParamAsString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

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

function actor(req: Request) {
  return {
    id: req.user!.userId,
    role: req.user!.role,
    ip: typeof req.ip === "string" ? req.ip : undefined,
  };
}

/** GET /api/campus/departments */
export async function listDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const includeInactive = getParamAsString(req.query.includeInactive) === "true";
    const data = await departments.listDepartments(collegeId, includeInactive);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** POST /api/campus/departments */
export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const name = getParamAsString(req.body?.name);
    const data = await departments.createDepartment(collegeId, name, actor(req));
    res.status(201).json({ success: true, data, message: "Department created" });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/campus/departments/:id */
export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await departments.updateDepartment(
      collegeId,
      getParamAsString(req.params.id),
      {
        name: req.body?.name != null ? String(req.body.name) : undefined,
        is_active: req.body?.is_active != null ? Boolean(req.body.is_active) : undefined,
      },
      actor(req)
    );
    res.json({ success: true, data, message: "Department updated" });
  } catch (err) {
    next(err);
  }
}
