import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import * as hub from "../services/studentLearningHub.service.js";

function uid(req: Request) {
  return req.user!.userId;
}

export async function getDashboard(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getDashboard(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getSummary(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPaths(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listPaths(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPath(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getPath(uid(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCourses(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const q = req.query as Record<string, string>;
    const data = await hub.listCourses(uid(req), {
      status: q.status,
      scope: q.scope || q.status,
      category: q.category,
      difficulty: q.difficulty,
      skill: q.skill,
      search: q.search || q.q,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCourse(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getCourse(uid(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getLesson(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getLesson(uid(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postLessonProgress(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.saveLessonProgress(uid(req), req.params.id, req.body || {});
    res.json({ success: true, data, message: "Progress saved" });
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

export async function getResources(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listResources(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listAssignments(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAssessments(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listAssessments(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCertificates(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listCertificates(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBookmarks(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.listBookmarks(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postBookmark(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.addBookmark(uid(req), req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteBookmark(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.removeBookmark(uid(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRecommendations(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await hub.getRecommendations(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getLearningEvents(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
    const data = await hub.getLearningEvents(uid(req), days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
