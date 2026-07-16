import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as evalSvc from "../services/collegeCampaignEvaluation.service.js";
import * as analyticsSvc from "../services/collegeCampaignAnalytics.service.js";

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

export async function listResults(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await evalSvc.listCampaignResults(
      collegeId,
      getParamAsString(req.params.id)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function evaluateCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await evalSvc.evaluateCampaignAttempts(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: `Evaluated ${data.evaluated} attempt(s)` });
  } catch (err) {
    next(err);
  }
}

export async function publishResults(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await evalSvc.publishCampaignResults(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Results published" });
  } catch (err) {
    next(err);
  }
}

export async function getEvaluation(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await evalSvc.getFacultyEvaluation(
      collegeId,
      getParamAsString(req.params.id),
      getParamAsString(req.params.evaluationId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function scoreShortAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await evalSvc.scoreShortAnswer(
      collegeId,
      getParamAsString(req.params.id),
      getParamAsString(req.params.evaluationId),
      getParamAsString(req.params.questionId),
      {
        marks_awarded: Number(req.body?.marks_awarded),
        is_correct: req.body?.is_correct,
        feedback: req.body?.feedback,
      },
      actor(req)
    );
    res.json({ success: true, data, message: "Short answer scored" });
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await analyticsSvc.getCampaignAnalytics(
      collegeId,
      getParamAsString(req.params.id)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function exportAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const formatRaw = getParamAsString(req.query.format).toLowerCase();
    const format = formatRaw === "pdf" ? "pdf" : "xlsx";
    const file = await analyticsSvc.exportCampaignAnalytics(
      collegeId,
      getParamAsString(req.params.id),
      format
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  } catch (err) {
    next(err);
  }
}
