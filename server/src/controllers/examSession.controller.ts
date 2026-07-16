// =============================================================================
// TalentSecure AI — Exam Session Controller
// =============================================================================

import { Request, Response, NextFunction } from "express";
import * as examSessionService from "../services/examSession.service.js";
import { getStudentDriveEvaluation } from "../services/assessmentEvaluation.service.js";

// GET /api/exam-sessions/my-drives
export async function getMyDrives(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const drives = await examSessionService.getStudentDrives(studentId);
        res.json({ success: true, data: drives });
    } catch (err) {
        next(err);
    }
}

// GET /api/exam-sessions/available-mocks
export async function getAvailableMocks(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const drives = await examSessionService.getAvailableSelfServiceDrives(studentId);
        res.json({ success: true, data: drives });
    } catch (err) {
        next(err);
    }
}

// POST /api/exam-sessions/:driveId/enroll
export async function enroll(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const { driveId } = req.params as { driveId: string };
        await examSessionService.enrollInSelfServiceDrive(driveId, studentId);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

// POST /api/exam-sessions/:driveId/start
export async function startSession(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const { driveId } = req.params as { driveId: string };
        const clientType =
            req.body?.clientType === "mobile_app" ||
            req.headers["x-client-type"] === "mobile_app"
                ? "mobile_app"
                : "web";
        const session = await examSessionService.startSession(driveId, studentId, clientType);
        res.json({ success: true, data: session });
    } catch (err) {
        next(err);
    }
}

// GET /api/exam-sessions/:driveId/session
export async function getSession(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const { driveId } = req.params as { driveId: string };
        const result = await examSessionService.getSession(driveId, studentId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

// PUT /api/exam-sessions/:driveId/save
export async function saveAnswer(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const { driveId } = req.params as { driveId: string };
        const result = await examSessionService.saveAnswer(driveId, studentId, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

// POST /api/exam-sessions/:driveId/submit
export async function submitExam(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const { driveId } = req.params as { driveId: string };
        const result = await examSessionService.submitExam(driveId, studentId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

// GET /api/exam-sessions/:driveId/evaluation
// Results & Evaluation for the student's own completed attempt (+ journey loop).
export async function getEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
        const studentId = req.user!.userId;
        const { driveId } = req.params as { driveId: string };
        const enrichAi = req.query.ai !== "0";
        const data = await getStudentDriveEvaluation(driveId, studentId, { enrichAi });
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}
