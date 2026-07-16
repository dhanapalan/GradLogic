import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as integrity from "../services/collegeCampaignIntegrity.service.js";

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

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await integrity.getCampaignIntegrityDashboard(
      collegeId,
      getParamAsString(req.params.id)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAttemptTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await integrity.getAttemptIntegrityTimeline(
      collegeId,
      getParamAsString(req.params.id),
      getParamAsString(req.params.attemptId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function reviewIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await integrity.reviewIncident(
      collegeId,
      getParamAsString(req.params.id),
      getParamAsString(req.params.incidentId),
      {
        status: req.body?.status,
        notes: req.body?.notes,
      },
      actor(req)
    );
    res.json({ success: true, data, message: "Incident updated" });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const settings = await integrity.persistCampaignIntegritySettings(
      collegeId,
      getParamAsString(req.params.id),
      req.body || {}
    );
    res.json({ success: true, data: settings, message: "Integrity settings saved" });
  } catch (err) {
    next(err);
  }
}
