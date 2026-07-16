import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as asm from "../services/collegeAssessment.service.js";

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

export async function getMeta(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: asm.metaCatalog() });
  } catch (err) {
    next(err);
  }
}

export async function listAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const result = await asm.listAssessments(collegeId, {
      search: getParamAsString(req.query.search),
      assessment_type: getParamAsString(req.query.assessment_type || req.query.type),
      category: getParamAsString(req.query.category),
      status: getParamAsString(req.query.status),
      page: parseInt(getParamAsString(req.query.page), 10) || 1,
      limit: parseInt(getParamAsString(req.query.limit), 10) || 20,
      sort: getParamAsString(req.query.sort) || "updated_at",
      order: getParamAsString(req.query.order) === "asc" ? "asc" : "desc",
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.getAssessment(collegeId, getParamAsString(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.createAssessment(collegeId, req.body, actor(req));
    res.status(201).json({ success: true, data, message: "Assessment created" });
  } catch (err) {
    next(err);
  }
}

export async function updateAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.updateAssessment(
      collegeId,
      getParamAsString(req.params.id),
      req.body,
      actor(req)
    );
    res.json({ success: true, data, message: "Assessment updated" });
  } catch (err) {
    next(err);
  }
}

export async function duplicateAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.duplicateAssessment(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.status(201).json({ success: true, data, message: "Assessment duplicated" });
  } catch (err) {
    next(err);
  }
}

export async function publishAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.publishAssessment(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Assessment published" });
  } catch (err) {
    next(err);
  }
}

export async function archiveAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.archiveAssessment(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Assessment archived" });
  } catch (err) {
    next(err);
  }
}

export async function softDeleteAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await asm.softDeleteAssessment(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Assessment soft-deleted" });
  } catch (err) {
    next(err);
  }
}
