import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as svc from "../services/collegeAssessmentAnalytics.service.js";

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

function actor(req: Request): svc.AnalyticsActor {
  return {
    id: req.user!.userId,
    role: req.user!.role,
    ip: typeof req.ip === "string" ? req.ip : undefined,
  };
}

function parseFilters(req: Request): svc.AnalyticsFilters {
  const q = req.query;
  const resultRaw = getParamAsString(q.result).toLowerCase();
  return {
    search: getParamAsString(q.search) || undefined,
    academic_year: getParamAsString(q.academic_year) || undefined,
    department: getParamAsString(q.department) || undefined,
    assessment_id: getParamAsString(q.assessment_id) || undefined,
    campaign_id: getParamAsString(q.campaign_id) || undefined,
    result: resultRaw === "pass" || resultRaw === "fail" ? resultRaw : undefined,
    date_from: getParamAsString(q.date_from) || undefined,
    date_to: getParamAsString(q.date_to) || undefined,
    page: Number(q.page) || undefined,
    limit: Number(q.limit) || undefined,
    sort: getParamAsString(q.sort) || undefined,
  };
}

function validateDateRange(filters: svc.AnalyticsFilters) {
  if (filters.date_from && filters.date_to) {
    const from = new Date(filters.date_from);
    const to = new Date(filters.date_to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError("Invalid date range", 400);
    }
    if (from > to) {
      throw new AppError("date_from must be before or equal to date_to", 400);
    }
  }
}

export async function getMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await svc.getMeta(collegeId, actor(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const filters = parseFilters(req);
    validateDateRange(filters);
    const data = await svc.getDashboard(collegeId, actor(req), filters);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const filters = parseFilters(req);
    validateDateRange(filters);
    const data = await svc.getAssessmentPerformance(collegeId, actor(req), filters);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const filters = parseFilters(req);
    validateDateRange(filters);
    const data = await svc.getStudentPerformance(collegeId, actor(req), filters);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const filters = parseFilters(req);
    validateDateRange(filters);
    const data = await svc.getDepartmentPerformance(collegeId, actor(req), filters);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const filters = parseFilters(req);
    validateDateRange(filters);
    const format = getParamAsString(req.query.format).toLowerCase() || "xlsx";
    const report = getParamAsString(req.query.report).toLowerCase() || "summary";
    if (!["xlsx", "pdf"].includes(format)) {
      throw new AppError("format must be xlsx or pdf", 400);
    }
    if (!["summary", "assessment", "student", "department", "campaign"].includes(report)) {
      throw new AppError("Invalid report type", 400);
    }
    const file = await svc.exportAnalytics(collegeId, actor(req), {
      ...filters,
      format,
      report,
    });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Content-Length", String(file.buffer.length));
    res.end(file.buffer);
  } catch (err) {
    next(err);
  }
}
