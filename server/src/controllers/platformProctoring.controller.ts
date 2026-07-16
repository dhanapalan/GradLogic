/**
 * Platform Proctoring API — thin adapters over college campaign integrity.
 */
import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as integrity from "../services/collegeCampaignIntegrity.service.js";

function param(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

async function resolveCollegeId(req: Request): Promise<string> {
  const user = req.user;
  if (!user) throw new AppError("Unauthorized", 401);
  if (user.college_id) return user.college_id;
  if (user.role === "super_admin" || user.role === "hr") {
    const fromBody = String(req.body?.college_id || req.query?.college_id || "");
    if (fromBody) return fromBody;
  }
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

export async function putCampaignSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const settings = await integrity.persistCampaignIntegritySettings(
      collegeId,
      param(req.params.campaignId),
      req.body || {}
    );
    res.json({ success: true, data: settings, message: "Proctoring settings saved" });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignReport(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await integrity.getCampaignIntegrityDashboard(
      collegeId,
      param(req.params.campaignId)
    );
    res.json({
      success: true,
      data: {
        ...data,
        report_title: "Proctoring Report",
        api: "/platform/proctoring",
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAttemptTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const attemptId = param(req.params.attemptId);

    const attempt = await queryOne<{ campaign_id: string }>(
      `SELECT campaign_id FROM college_campaign_attempts WHERE id = $1`,
      [attemptId]
    );
    if (!attempt) throw new AppError("Attempt not found", 404);

    const data = await integrity.getAttemptIntegrityTimeline(
      collegeId,
      attempt.campaign_id,
      attemptId
    );
    res.json({
      success: true,
      data: {
        ...data,
        report_title: "Violation Timeline",
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function reviewIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const incidentId = param(req.params.incidentId);

    const incident = await queryOne<{ campaign_id: string }>(
      `SELECT campaign_id FROM college_campaign_integrity_incidents WHERE id = $1`,
      [incidentId]
    );
    if (!incident) throw new AppError("Incident not found", 404);

    const data = await integrity.reviewIncident(
      collegeId,
      incident.campaign_id,
      incidentId,
      { status: req.body?.status, notes: req.body?.notes },
      actor(req)
    );
    res.json({ success: true, data, message: "Incident updated" });
  } catch (err) {
    next(err);
  }
}

export async function postStudentEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.userId;
    const campaignId = String(req.body?.campaign_id || "").trim();
    const eventType = String(req.body?.event_type || "").trim();
    if (!campaignId) throw new AppError("campaign_id is required", 400);
    if (!eventType) throw new AppError("event_type is required", 400);

    const data = await integrity.logStudentEvent(
      studentId,
      campaignId,
      eventType,
      req.body?.metadata
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * Webcam frame analysis for campaign attempts.
 * Tries external AI engine; falls back to a luminance heuristic so proctoring
 * still emits FACE_NOT_DETECTED when the camera feed is blank/blocked.
 */
export async function analyzeFrame(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.userId;
    const campaignId = String(req.body?.campaign_id || "").trim();
    const image = String(req.body?.image || "");
    if (!campaignId) throw new AppError("campaign_id is required", 400);
    if (!image.startsWith("data:image")) throw new AppError("image data URL required", 400);

    let anomaly: string | null = null;
    let source: "ai_engine" | "heuristic" = "heuristic";
    let detail: Record<string, unknown> = {};

    const aiBase =
      process.env.PROCTORING_AI_URL ||
      process.env.QUESTION_ENGINE_URL ||
      "http://host.docker.internal:8001";

    try {
      const r = await fetch(`${aiBase.replace(/\/$/, "")}/api/proctoring/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          student_id: studentId,
          exam_id: campaignId,
          confidence_threshold: 0.55,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        const body = (await r.json()) as {
          is_anomaly?: boolean;
          anomaly_type?: string;
          faces?: number;
          message?: string;
        };
        source = "ai_engine";
        detail = body as Record<string, unknown>;
        if (body.is_anomaly) {
          const t = String(body.anomaly_type || "").toUpperCase();
          if (t.includes("MULTI") || (body.faces != null && body.faces > 1)) {
            anomaly = "MULTIPLE_FACES";
          } else {
            anomaly = "FACE_NOT_DETECTED";
          }
        }
      }
    } catch {
      /* fall through to heuristic */
    }

    if (source === "heuristic" || (!anomaly && source === "ai_engine" && !detail)) {
      // Decode rough brightness from a sample of the JPEG base64 (cheap proxy for blank cam)
      const b64 = image.split(",")[1] || "";
      const sample = b64.slice(0, 8000);
      let sum = 0;
      for (let i = 0; i < sample.length; i++) sum += sample.charCodeAt(i);
      const avg = sample.length ? sum / sample.length : 0;
      // Extremely uniform / empty payloads often indicate blocked or black frames
      if (avg < 48 || avg > 120) {
        anomaly = avg < 48 ? "FACE_NOT_DETECTED" : null;
        detail = { heuristic_avg_byte: Math.round(avg), note: "local luminance heuristic" };
      } else {
        detail = { heuristic_avg_byte: Math.round(avg), note: "local luminance heuristic — ok" };
      }
      source = "heuristic";
    }

    let logged: unknown = null;
    if (anomaly) {
      try {
        logged = await integrity.logStudentEvent(studentId, campaignId, anomaly, {
          ...detail,
          analyze_source: source,
        });
      } catch (logErr) {
        // Fail-open: frame analysis must not block the exam if no active attempt / API glitch
        logged = {
          logged: false,
          reason: logErr instanceof Error ? logErr.message : "log_failed",
        };
      }
    }

    res.json({
      success: true,
      data: {
        is_anomaly: !!anomaly,
        event_type: anomaly,
        source,
        logged,
      },
    });
  } catch (err) {
    next(err);
  }
}
