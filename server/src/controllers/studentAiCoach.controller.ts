import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import { logger } from "../config/logger.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAiUsage } from "../services/aiUsage.service.js";
import * as hub from "../services/studentAiCoach.service.js";

function uid(req: Request) {
  return req.user!.userId;
}

function writeSse(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  return (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function getDashboard(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getDashboard(uid(req));
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

export async function getStudyPlan(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getStudyPlan(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getLearningPath(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getLearningPath(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPracticeRecommendations(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const data = await hub.getPracticeRecommendations(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getWeakAreas(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getWeakAreas(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProgress(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getProgress(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postGenerateStudyPlan(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const max = Number(req.body?.max_steps || req.body?.maxSteps || 5);
    const data = await hub.generateStudyPlan(uid(req), max);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getExplainResultContext(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const attemptId = String(req.query.attempt_id || req.params.attemptId || "");
    const data = await hub.explainResultContext(uid(req), attemptId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postChat(req: Request, res: Response) {
  const message = String(req.body?.message || "").trim();
  if (!message) {
    res.status(400).json({ success: false, error: "message is required" });
    return;
  }
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  logAiUsage("ai_coach_chat", uid(req));

  const send = writeSse(res);
  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    const result = await hub.streamCoachReply(uid(req), message, history, (chunk) => {
      if (!clientGone) send({ type: "delta", text: chunk });
    });
    if (!clientGone) send({ type: "done", text: result.text, requiresReview: result.requiresReview });
  } catch (err) {
    logger.error("AI Coach chat failed:", err);
    if (!clientGone) send({ type: "error", message: errMessage(err, "AI Coach hit an error") });
  } finally {
    if (!clientGone) res.end();
  }
}

export async function postExplainResult(req: Request, res: Response) {
  const attemptId = String(req.body?.attempt_id || req.body?.attemptId || "").trim();
  if (!attemptId) {
    res.status(400).json({ success: false, error: "attempt_id is required" });
    return;
  }
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const extra = typeof req.body?.message === "string" ? req.body.message : undefined;
  logAiUsage("ai_coach_explain_result", uid(req));

  const send = writeSse(res);
  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    const result = await hub.streamExplainResult(uid(req), attemptId, history, (chunk) => {
      if (!clientGone) send({ type: "delta", text: chunk });
    }, extra);
    if (!clientGone) {
      send({
        type: "done",
        text: result.text,
        requiresReview: result.requiresReview,
        context: {
          overall_summary: result.context.overall_summary,
          continue_learning: result.context.continue_learning,
        },
      });
    }
  } catch (err) {
    logger.error("AI Coach explain-result failed:", err);
    if (!clientGone) send({ type: "error", message: errMessage(err, "Could not explain result") });
  } finally {
    if (!clientGone) res.end();
  }
}

export async function postExplainQuestion(req: Request, res: Response) {
  logAiUsage("ai_coach_explain_question", uid(req));
  const send = writeSse(res);
  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    const result = await hub.streamExplainQuestion(uid(req), req.body || {}, (chunk) => {
      if (!clientGone) send({ type: "delta", text: chunk });
    });
    if (!clientGone) {
      send({
        type: "done",
        text: result.text,
        requiresReview: result.requiresReview,
        source: result.source,
      });
    }
  } catch (err) {
    logger.error("AI Coach explain-question failed:", err);
    if (!clientGone) send({ type: "error", message: errMessage(err, "Could not explain question") });
  } finally {
    if (!clientGone) res.end();
  }
}
