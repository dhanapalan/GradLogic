import { Request, Response, NextFunction } from "express";
import * as workspace from "../services/studentAssessmentWorkspace.service.js";
import * as attempt from "../services/studentCampaignAttempt.service.js";
import * as evaluation from "../services/collegeCampaignEvaluation.service.js";
import * as integrity from "../services/collegeCampaignIntegrity.service.js";

function getParamAsString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

export async function getMeta(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: workspace.metaCatalog() });
  } catch (err) {
    next(err);
  }
}

export async function listMyAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.userId;
    const result = await workspace.listMyAssessments(studentId, {
      search: getParamAsString(req.query.search),
      status: getParamAsString(req.query.status),
      assessment_type: getParamAsString(req.query.assessment_type),
      page: parseInt(getParamAsString(req.query.page), 10) || 1,
      limit: parseInt(getParamAsString(req.query.limit), 10) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getMyAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.userId;
    const data = await workspace.getMyAssessment(
      studentId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getInstructions(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.userId;
    const data = await workspace.getInstructions(
      studentId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function startAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.userId;
    const data = await workspace.startAssessment(
      studentId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    next(err);
  }
}

export async function getAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attempt.getAttemptWorkspace(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function syncAttemptTimer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attempt.syncAttemptTimer(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function saveAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attempt.saveAttempt(
      req.user!.userId,
      getParamAsString(req.params.campaignId),
      req.body || {}
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSubmissionSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attempt.getSubmissionSummary(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function submitAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attempt.submitAttempt(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    next(err);
  }
}

export async function getSubmissionCompletion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attempt.getSubmissionCompletion(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStudentResult(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await evaluation.getStudentResult(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** Module 09 — student integrity event logging (fire-and-forget from attempt UI). */
export async function logIntegrityEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await integrity.logStudentEvent(
      req.user!.userId,
      getParamAsString(req.params.campaignId),
      String(req.body?.event_type || req.body?.eventType || ""),
      (req.body?.metadata && typeof req.body.metadata === "object"
        ? req.body.metadata
        : {}) as Record<string, unknown>
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getIntegrityStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await integrity.getStudentIntegrityContext(
      req.user!.userId,
      getParamAsString(req.params.campaignId)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
