import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import * as dashboard from "../services/studentDashboard.service.js";
import * as notificationService from "../services/notification.service.js";
import * as examSession from "../services/examSession.service.js";

function studentId(req: Request): string {
  return req.user!.userId;
}

export async function getDashboard(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getDashboardShell(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUpcomingAssessments(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 8;
    const data = await dashboard.getUpcomingAssessments(studentId(req), limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRecentResults(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 8;
    const data = await dashboard.getRecentResults(studentId(req), limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAssignedLearning(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getAssignedLearning(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getReadiness(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getReadiness(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSkills(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getSkills(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRecommendations(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getRecommendations(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getEligibleCampusDrives(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getEligibleCampusDrives(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function applyCampusDrive(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const driveId = String(req.params.driveId || "");
    await examSession.enrollInSelfServiceDrive(driveId, studentId(req));
    res.json({ success: true, message: "Enrolled successfully" });
  } catch (err) {
    next(err);
  }
}

export async function getAchievements(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await dashboard.getAchievements(studentId(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCalendarEvents(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
    const data = await dashboard.getCalendarEvents(studentId(req), days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getNotifications(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 8;
    const data = await dashboard.getDashboardNotifications(studentId(req), limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const result = await notificationService.markAsRead(String(req.params.id), studentId(req));
    if (!result) {
      res.status(404).json({ success: false, error: "Notification not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
