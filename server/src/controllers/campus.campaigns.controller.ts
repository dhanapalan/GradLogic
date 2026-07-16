import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as camp from "../services/collegeAssessmentCampaign.service.js";

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
    res.json({ success: true, data: camp.metaCatalog() });
  } catch (err) {
    next(err);
  }
}

export async function listCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const result = await camp.listCampaigns(collegeId, {
      search: getParamAsString(req.query.search),
      status: getParamAsString(req.query.status),
      page: parseInt(getParamAsString(req.query.page), 10) || 1,
      limit: parseInt(getParamAsString(req.query.limit), 10) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.getCampaign(collegeId, getParamAsString(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.createCampaign(collegeId, req.body, actor(req));
    res.status(201).json({ success: true, data, message: "Campaign created" });
  } catch (err) {
    next(err);
  }
}

export async function updateCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.updateCampaign(
      collegeId,
      getParamAsString(req.params.id),
      req.body,
      actor(req)
    );
    res.json({ success: true, data, message: "Campaign updated" });
  } catch (err) {
    next(err);
  }
}

export async function publishCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.publishCampaign(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Campaign published" });
  } catch (err) {
    next(err);
  }
}

export async function closeCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.closeCampaign(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Campaign closed" });
  } catch (err) {
    next(err);
  }
}

export async function archiveCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.archiveCampaign(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Campaign archived" });
  } catch (err) {
    next(err);
  }
}

export async function softDeleteCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.softDeleteCampaign(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Campaign soft-deleted" });
  } catch (err) {
    next(err);
  }
}

export async function previewAudience(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await camp.previewAudience(collegeId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
