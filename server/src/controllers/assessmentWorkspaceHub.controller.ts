import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import * as hub from "../services/assessmentWorkspaceHub.service.js";

function uid(req: Request) {
  return req.user!.userId;
}

function attemptId(req: Request) {
  const v = req.params.attemptId;
  return Array.isArray(v) ? String(v[0] ?? "") : String(v || "");
}

export async function postLaunch(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const campaignId = String(req.body?.campaign_id || req.body?.campaignId || "");
    const data = await hub.launch(uid(req), campaignId);
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    next(err);
  }
}

export async function getWorkspace(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getWorkspace(uid(req), attemptId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getQuestions(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getQuestions(uid(req), attemptId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postResponse(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.saveResponse(uid(req), attemptId(req), req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putResponse(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.saveResponse(uid(req), attemptId(req), req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postAutosave(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.autosave(uid(req), attemptId(req), req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postHeartbeat(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.heartbeat(uid(req), attemptId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postTelemetry(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.telemetry(uid(req), attemptId(req), {
      event_type: String(req.body?.event_type || req.body?.eventType || ""),
      metadata:
        req.body?.metadata && typeof req.body.metadata === "object"
          ? req.body.metadata
          : {},
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postResume(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.resume(uid(req), attemptId(req));
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    next(err);
  }
}

export async function postSubmit(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.submit(uid(req), attemptId(req));
    res.json({ success: true, data, message: data.message || "Assessment submitted" });
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getSummary(uid(req), attemptId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
