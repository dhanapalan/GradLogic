import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.js";
import * as campusStudentsController from "../controllers/campus.students.controller.js";

const router = Router();

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const VIEW_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "placement_cell",
  "instructor",
  "super_admin",
  "hr",
] as const;

const MANAGE_ROLES = ["college_admin", "college", "college_staff", "super_admin", "hr"] as const;

/** Add / Edit / Bulk: Org Admin, College Admin, Placement Officer */
const WRITE_ROLES = [
  "college_admin",
  "college",
  "placement_cell",
  "super_admin",
  "hr",
] as const;

router.use(authenticate);

router.get(
  "/analytics",
  authorize(...MANAGE_ROLES),
  campusStudentsController.getAnalytics
);

router.get("/", authorize(...MANAGE_ROLES, "placement_cell", "instructor"), campusStudentsController.listStudents);

router.post("/", authorize(...WRITE_ROLES), campusStudentsController.createStudent);

// Sprint 2.3 — bulk upload (before /:id)
router.get(
  "/bulk-template",
  authorize(...WRITE_ROLES),
  campusStudentsController.downloadBulkTemplate
);
router.post(
  "/bulk-validate",
  authorize(...WRITE_ROLES),
  excelUpload.single("file"),
  campusStudentsController.bulkValidate
);
router.post(
  "/bulk-import",
  authorize(...WRITE_ROLES),
  campusStudentsController.bulkImport
);
router.post(
  "/bulk-error-report",
  authorize(...WRITE_ROLES),
  campusStudentsController.bulkErrorReport
);

router.post("/bulk-action", authorize(...MANAGE_ROLES), campusStudentsController.bulkAction);

// Sprint 2.4 — student documents (before bare /:id)
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Sprint 2.5 — placement eligibility
router.get(
  "/:id/eligibility",
  authorize(...VIEW_ROLES),
  campusStudentsController.getStudentEligibility
);
router.get(
  "/:id/eligibility/history",
  authorize(...VIEW_ROLES),
  campusStudentsController.getStudentEligibilityHistory
);
router.put(
  "/:id/eligibility",
  authorize(...WRITE_ROLES),
  campusStudentsController.setStudentEligibility
);

router.get(
  "/:id/documents",
  authorize(...VIEW_ROLES),
  campusStudentsController.listStudentDocuments
);
router.post(
  "/:id/documents",
  authorize(...WRITE_ROLES),
  docUpload.single("file"),
  campusStudentsController.uploadStudentDocument
);
router.get(
  "/:id/documents/:docId/download",
  authorize(...VIEW_ROLES),
  campusStudentsController.downloadStudentDocument
);
router.get(
  "/:id/documents/:docId/preview",
  authorize(...VIEW_ROLES),
  campusStudentsController.previewStudentDocument
);
router.delete(
  "/:id/documents/:docId",
  authorize(...WRITE_ROLES),
  campusStudentsController.deleteStudentDocument
);

router.get("/:id", authorize(...VIEW_ROLES), campusStudentsController.getStudentProfile);
router.put("/:id", authorize(...WRITE_ROLES), campusStudentsController.updateStudent);
router.delete("/:id", authorize(...MANAGE_ROLES), campusStudentsController.softDeleteStudent);

export default router;
