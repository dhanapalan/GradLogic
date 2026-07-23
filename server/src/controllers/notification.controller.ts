import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notification.service.js";
import { runDigestNow } from "../queues/notificationDigest.queue.js";
import { ApiResponse } from "../types/index.js";

// GET /api/notifications
export const getUserNotifications = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        const unreadOnly = req.query.unread === 'true';
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const notifications = await notificationService.getUserNotifications(userId, unreadOnly, limit);
        res.json({ success: true, data: notifications });
    } catch (err) {
        next(err);
    }
};

// PUT /api/notifications/:id/read
export const markAsRead = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        const notificationId = req.params.id as string;
        const result = await notificationService.markAsRead(notificationId, userId);
        if (!result) {
            return res.status(404).json({ success: false, error: "Notification not found" });
        }

        res.json({ success: true, data: result, message: "Marked as read" });
    } catch (err) {
        next(err);
    }
};

// PUT /api/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        await notificationService.markAllAsRead(userId);
        res.json({ success: true, message: "All notifications marked as read" });
    } catch (err) {
        next(err);
    }
};

// POST /api/notifications/run-digest — ops/testing: trigger the EOD assessment
// digest immediately instead of waiting for the 6pm scheduled run.
export const runDigestNowHandler = async (_req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        await runDigestNow();
        res.json({ success: true, message: "Digest job queued" });
    } catch (err) {
        next(err);
    }
};
