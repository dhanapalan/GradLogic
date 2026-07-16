import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import * as hub from "../services/studentResultsAnalytics.service.js";

function uid(req: Request) {
  return req.user!.userId;
}

function attemptId(req: Request) {
  const v = req.params.attemptId;
  return Array.isArray(v) ? String(v[0] ?? "") : String(v || "");
}

function historyFilters(req: Request): hub.HistoryFilters {
  const q = req.query as Record<string, string>;
  return {
    search: q.search || q.q,
    skill: q.skill,
    assessment_type: q.assessment_type || q.type,
    status: q.status,
    date_from: q.date_from,
    date_to: q.date_to,
    page: q.page ? parseInt(q.page, 10) : undefined,
    limit: q.limit ? parseInt(q.limit, 10) : undefined,
  };
}

export async function getHistory(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getHistory(uid(req), historyFilters(req));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getAttempt(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getAttemptSummary(uid(req), attemptId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAttemptQuestions(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const data = await hub.getAttemptQuestions(uid(req), attemptId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPerformance(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getPerformanceOverview(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSkills(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getSkillAnalysis(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTopics(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getTopicAnalysis(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSubtopics(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getSubtopicAnalysis(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDifficulty(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getDifficultyAnalysis(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBloom(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getBloomAnalysis(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getLearningOutcomes(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getLearningOutcomes(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTrends(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getTrends(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getReadiness(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    // Students: Module 07 enriched readiness. Admins keep existing handler elsewhere.
    const data = await hub.getReadinessAnalytics(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRecommendations(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const data = await hub.getRecommendations(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStrengths(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const attempt = typeof req.query.attempt_id === "string" ? req.query.attempt_id : undefined;
    const data = await hub.getStrengthsAndGaps(uid(req), attempt);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postBookmark(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? String(req.params.id[0]) : String(req.params.id || "");
    const data = await hub.bookmarkQuestion(uid(req), id, req.body?.meta);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
