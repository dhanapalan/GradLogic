import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/drive.controller.js";

const router = Router();
const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const isCsv = file.mimetype === 'text/csv'
            || file.mimetype === 'application/vnd.ms-excel'
            || file.originalname.toLowerCase().endsWith('.csv');
        cb(null, isCsv ? true : false);
    },
});

// All routes require authentication
router.use(authenticate);

// GET  /api/drives — platform admins only (college roles use /api/campus/drives)
router.get(
    "/",
    authorize("super_admin", "hr", "engineer"),
    ctrl.list,
);

// GET  /api/drives/:id
router.get(
    "/:id",
    authorize("super_admin", "hr", "engineer"),
    ctrl.getById,
);

// POST /api/drives
router.post(
    "/",
    authorize("super_admin", "hr"),
    ctrl.create,
);

// PUT  /api/drives/:id
router.put(
    "/:id",
    authorize("super_admin", "hr"),
    ctrl.update,
);

// POST /api/drives/:id/generate
router.post(
    "/:id/generate",
    authorize("super_admin", "hr"),
    ctrl.generate,
);

// GET /api/drives/:id/pool
router.get(
    "/:id/pool",
    authorize("super_admin", "hr", "engineer"),
    ctrl.getPool,
);

// POST /api/drives/:id/pool/approve
router.post(
    "/:id/pool/approve",
    authorize("super_admin", "hr"),
    ctrl.approvePool,
);

// POST /api/drives/:id/pool/reject
router.post(
    "/:id/pool/reject",
    authorize("super_admin", "hr"),
    ctrl.rejectPool,
);

// PUT /api/drives/questions/:queryId
router.put(
    "/questions/:queryId",
    authorize("super_admin", "hr", "engineer"),
    ctrl.editQuestion,
);

// PATCH /api/drives/questions/:queryId/status
router.patch(
    "/questions/:queryId/status",
    authorize("super_admin", "hr", "engineer"),
    ctrl.updateQuestionStatus,
);

// POST /api/drives/:id/pool/regenerate
router.post(
    "/:id/pool/regenerate",
    authorize("super_admin", "hr", "engineer"),
    ctrl.regeneratePool,
);

// POST /api/drives/:id/cancel
router.post(
    "/:id/cancel",
    authorize("super_admin", "hr"),
    ctrl.cancel,
);

// POST /api/drives/:id/ready
router.post(
    "/:id/ready",
    authorize("super_admin", "hr"),
    ctrl.markReady,
);

// POST /api/drives/:id/publish
router.post(
    "/:id/publish",
    authorize("super_admin", "hr"),
    ctrl.publish,
);

// GET /api/drives/:id/collections
router.get(
    "/:id/collections",
    authorize("super_admin", "hr", "engineer"),
    ctrl.listCollections,
);

// POST /api/drives/:id/collections — attach + seed from Question Collections
router.post(
    "/:id/collections",
    authorize("super_admin", "hr"),
    ctrl.attachCollections,
);

// POST /api/drives/:id/seed-from-collections
router.post(
    "/:id/seed-from-collections",
    authorize("super_admin", "hr"),
    ctrl.seedFromCollections,
);

// GET  /api/drives/:id/students
router.get(
    "/:id/students",
    authorize("super_admin", "hr", "engineer"),
    ctrl.getStudents,
);

// POST /api/drives/:id/students (add by IDs)
router.post(
    "/:id/students",
    authorize("super_admin", "hr"),
    ctrl.addStudents,
);

// POST /api/drives/:id/students/csv (CSV upload)
router.post(
    "/:id/students/csv",
    authorize("super_admin", "hr"),
    csvUpload.single('file'),
    ctrl.addStudentsByCSV,
);

// POST /api/drives/:id/students/campus (bulk add by campus)
router.post(
    "/:id/students/campus",
    authorize("super_admin", "hr"),
    ctrl.addStudentsByCampus,
);

// DELETE /api/drives/:id/students/:studentId
router.delete(
    "/:id/students/:studentId",
    authorize("super_admin", "hr"),
    ctrl.removeStudent,
);

// GET  /api/drives/:id/assignments
router.get(
    "/:id/assignments",
    authorize("super_admin", "hr", "engineer"),
    ctrl.getAssignments,
);

// POST /api/drives/:id/assignments
router.post(
    "/:id/assignments",
    authorize("super_admin", "hr"),
    ctrl.addAssignment,
);

// POST /api/drives/:id/students/:studentId/shortlist
router.post(
    "/:id/students/:studentId/shortlist",
    authorize("super_admin", "hr"),
    ctrl.shortlistStudent,
);

// POST /api/drives/:id/students/:studentId/interview
router.post(
    "/:id/students/:studentId/interview",
    authorize("super_admin", "hr"),
    ctrl.scheduleInterview,
);

// POST /api/drives/:id/students/:studentId/interview-feedback
router.post(
    "/:id/students/:studentId/interview-feedback",
    authorize("super_admin", "hr"),
    ctrl.completeInterview,
);

// POST /api/drives/:id/students/:studentId/offer
router.post(
    "/:id/students/:studentId/offer",
    authorize("super_admin", "hr"),
    ctrl.releaseOffer,
);

export default router;
