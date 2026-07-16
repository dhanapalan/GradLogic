import { Request, Response, NextFunction } from "express";
import * as driveService from "../services/drive.service.js";
import { ApiResponse } from "../types/index.js";

// GET /api/drives
export const list = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const { status, rule_id, drive_type } = req.query;
        const drives = await driveService.listDrives({
            status: status as string | undefined,
            rule_id: rule_id as string | undefined,
            drive_type: drive_type as string | undefined,
        });
        res.json({ success: true, data: drives });
    } catch (err) { next(err); }
};

// GET /api/drives/:id
export const getById = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const drive = await driveService.getDriveById(req.params.id as string);
        if (!drive) return res.status(404).json({ success: false, error: "Drive not found" });
        res.json({ success: true, data: drive });
    } catch (err) { next(err); }
};

// POST /api/drives
export const create = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const drive = await driveService.createDrive({ ...req.body, created_by: userId });
        res.status(201).json({ success: true, data: drive, message: "Drive created" });
    } catch (err) { next(err); }
};

// PUT /api/drives/:id
export const update = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const drive = await driveService.updateDrive(req.params.id as string, req.body);
        res.json({ success: true, data: drive, message: "Drive updated" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/generate
export const generate = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const drive = await driveService.generateDrive(req.params.id as string);
        if (!drive) return res.status(404).json({ success: false, error: "Drive not found" });
        res.json({ success: true, data: drive, message: "Drive pool generation started" });
    } catch (err) { next(err); }
};

// GET /api/drives/:id/pool
export const getPool = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const pool = await driveService.getDrivePool(req.params.id as string);
        if (!pool) return res.status(404).json({ success: false, error: "Pool not found" });
        res.json({ success: true, data: pool });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/pool/approve
export const approvePool = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId || 'system';
        const drive = await driveService.approveDrivePool(req.params.id as string, userId);
        res.json({ success: true, data: drive, message: "Drive pool approved and locked" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/pool/reject
export const rejectPool = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId || 'system';
        const { reason } = req.body;
        const drive = await driveService.rejectDrivePool(req.params.id as string, userId, reason);
        res.json({ success: true, data: drive, message: "Drive pool rejected" });
    } catch (err) { next(err); }
};

// PUT /api/drives/questions/:queryId
export const editQuestion = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId || 'system';
        await driveService.editQuestion(req.params.queryId as string, req.body, userId);
        res.json({ success: true, message: "Question updated" });
    } catch (err) { next(err); }
};

// PATCH /api/drives/questions/:queryId/status
export const updateQuestionStatus = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId || 'system';
        await driveService.updateQuestionStatus(req.params.queryId as string, req.body.status, userId);
        res.json({ success: true, message: "Question status updated" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/pool/regenerate
export const regeneratePool = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        await driveService.regenerateQuestions(req.params.id as string, req.body.type || 'full');
        res.json({ success: true, message: "Pool regeneration triggered" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/cancel
export const cancel = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const drive = await driveService.cancelDrive(req.params.id as string);
        res.json({ success: true, data: drive, message: "Drive cancelled" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/ready
export const markReady = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const drive = await driveService.markDriveReady(req.params.id as string);
        res.json({ success: true, data: drive, message: "Drive is now READY" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/publish
export const publish = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const drive = await driveService.publishDrive(req.params.id as string);
        res.json({ success: true, data: drive, message: "Drive published" });
    } catch (err) { next(err); }
};

// GET /api/drives/:id/collections
export const listCollections = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const data = await driveService.listDriveCollections(req.params.id as string);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/collections — attach collections and reseed pool (assemble only)
export const attachCollections = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const driveId = req.params.id as string;
        const collectionIds: string[] = req.body?.collection_ids || [];
        const sections = req.body?.sections;
        if (!Array.isArray(collectionIds) || collectionIds.length === 0) {
            return res.status(400).json({ success: false, error: "collection_ids required" });
        }
        await driveService.attachDriveCollections(driveId, collectionIds, sections);
        const seed = await driveService.seedPoolFromCollections(driveId);
        const drive = await driveService.getDriveById(driveId);
        res.json({
            success: true,
            data: { drive, seed },
            message: `Pool assembled from collections (${seed.inserted} questions)`,
        });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/seed-from-collections
export const seedFromCollections = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const seed = await driveService.seedPoolFromCollections(req.params.id as string);
        const drive = await driveService.getDriveById(req.params.id as string);
        res.json({
            success: true,
            data: { drive, seed },
            message: `Reseeded pool (${seed.inserted} questions)`,
        });
    } catch (err) { next(err); }
};

// GET /api/drives/:id/students
export const getStudents = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const { search, status } = req.query;
        const students = await driveService.getDriveStudents(req.params.id as string, {
            search: search as string | undefined,
            status: status as string | undefined,
        });
        res.json({ success: true, data: students });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students — add by IDs
export const addStudents = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const { student_ids } = req.body;
        if (!student_ids || !Array.isArray(student_ids)) {
            return res.status(400).json({ success: false, error: "student_ids array is required" });
        }
        // Accepts an array of student_ids
        const rows = student_ids.map((id: string) => ({ student_id: id }));
        const result = await driveService.addStudentsByCSV(req.params.id as string, rows);
        res.status(201).json({ success: true, data: result, message: `${result.added} student(s) invited` });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students/csv — CSV upload
export const addStudentsByCSV = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, error: "CSV file is required" });
        }

        const csvText = file.buffer.toString('utf-8');
        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            return res.status(400).json({ success: false, error: "CSV must have a header row and at least one data row" });
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
        const emailIdx = headers.findIndex(h => ['email', 'email_id', 'emailid'].includes(h));
        const idIdx = headers.findIndex(h => ['student_id', 'studentid', 'roll_number', 'rollnumber', 'roll_no'].includes(h));

        if (emailIdx === -1 && idIdx === -1) {
            return res.status(400).json({ success: false, error: "CSV must have an 'email' or 'student_id' column" });
        }

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            rows.push({
                email: emailIdx >= 0 ? cols[emailIdx] : undefined,
                student_id: idIdx >= 0 ? cols[idIdx] : undefined,
            });
        }

        const result = await driveService.addStudentsByCSV(req.params.id as string, rows);
        res.status(201).json({ success: true, data: result, message: `${result.added} student(s) invited from CSV` });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students/campus — bulk add by campus
export const addStudentsByCampus = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const { college_id, segment } = req.body;
        if (!college_id) {
            return res.status(400).json({ success: false, error: "college_id is required" });
        }
        const result = await driveService.addStudentsByCampus(req.params.id as string, college_id, segment);
        res.status(201).json({ success: true, data: result, message: `Students invited from campus` });
    } catch (err) { next(err); }
};

// DELETE /api/drives/:id/students/:studentId
export const removeStudent = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        await driveService.removeDriveStudent(req.params.id as string, req.params.studentId as string);
        res.json({ success: true, message: "Student removed from drive" });
    } catch (err) { next(err); }
};

// GET /api/drives/:id/assignments
export const getAssignments = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const assignments = await driveService.getDriveAssignments(req.params.id as string);
        res.json({ success: true, data: assignments });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/assignments
export const addAssignment = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const assignment = await driveService.addDriveAssignment(req.params.id as string, req.body.college_id, req.body.segment);
        res.status(201).json({ success: true, data: assignment });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students/:studentId/shortlist
export const shortlistStudent = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const result = await driveService.shortlistDriveStudent(req.params.id as string, req.params.studentId as string);
        res.json({ success: true, data: result, message: "Student shortlisted successfully" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students/:studentId/interview
export const scheduleInterview = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const result = await driveService.scheduleDriveInterview(req.params.id as string, req.params.studentId as string, req.body.interview_date);
        res.json({ success: true, data: result, message: "Interview scheduled successfully" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students/:studentId/interview-feedback
export const completeInterview = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const result = await driveService.completeDriveInterview(req.params.id as string, req.params.studentId as string, req.body.feedback, req.body.score);
        res.json({ success: true, data: result, message: "Interview completed successfully" });
    } catch (err) { next(err); }
};

// POST /api/drives/:id/students/:studentId/offer
export const releaseOffer = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const result = await driveService.releaseDriveOffer(req.params.id as string, req.params.studentId as string);
        res.json({ success: true, data: result, message: "Offer released successfully" });
    } catch (err) { next(err); }
};
