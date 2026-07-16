import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import * as hub from "../services/studentAssessmentsHub.service.js";

function uid(req: Request) {
  return req.user!.userId;
}

function filters(req: Request): hub.HubFilters {
  const q = req.query as Record<string, string>;
  return {
    search: q.search || q.q,
    assessment_type: q.assessment_type || q.type,
    subject: q.subject,
    campaign: q.campaign,
    date_from: q.date_from,
    date_to: q.date_to,
    page: q.page ? parseInt(q.page, 10) : undefined,
    limit: q.limit ? parseInt(q.limit, 10) : undefined,
    sort: q.sort,
  };
}

export async function getDashboard(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getDashboard(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAssigned(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listAssigned(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getLive(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listLive(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getInProgress(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listInProgress(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getCompleted(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listCompleted(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getMissed(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listMissed(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getPractice(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listPractice(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

/** Module 05 upcoming list (paginated). Module 02 GET /upcoming remains unchanged. */
export async function getUpcomingList(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listUpcoming(uid(req), filters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getAssessment(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getAssessment(uid(req), req.params.assessmentId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAttempts(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listAttempts(uid(req), req.params.assessmentId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postLaunch(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.launchAssessment(uid(req), req.params.assessmentId);
    res.json({ success: true, data, message: data.message || "Assessment launched" });
  } catch (err) {
    next(err);
  }
}

export async function postResume(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.resumeAssessment(uid(req), req.params.assessmentId);
    res.json({ success: true, data, message: data.message || "Assessment resumed" });
  } catch (err) {
    next(err);
  }
}

export async function getCalendarAssessments(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 60;
    const data = await hub.getAssessmentCalendar(uid(req), days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAssessmentNotifications(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const data = await hub.getAssessmentNotifications(uid(req), limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
