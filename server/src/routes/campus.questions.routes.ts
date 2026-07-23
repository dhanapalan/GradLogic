import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/campus.questions.controller.js";

const router = Router();

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** View: Admin, Faculty, Placement Officer */
const VIEW_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "placement_cell",
  "super_admin",
  "hr",
] as const;

/** Create / Edit / Duplicate: Admin + Faculty (not Placement) */
const WRITE_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "super_admin",
  "hr",
] as const;

/** Import + soft delete: Org/College Admin */
const MANAGE_ROLES = ["college_admin", "college", "super_admin", "hr"] as const;

router.use(authenticate);

router.get("/meta", authorize(...VIEW_ROLES), ctrl.getMeta);
router.get("/import-template", authorize(...MANAGE_ROLES), ctrl.downloadImportTemplate);
router.post(
  "/import",
  authorize(...MANAGE_ROLES),
  excelUpload.single("file"),
  ctrl.importQuestions
);

router.post("/bulk-action", authorize(...MANAGE_ROLES), ctrl.bulkAction);
router.post("/ai-import", authorize(...WRITE_ROLES), ctrl.aiImportQuestions);

router.get("/", authorize(...VIEW_ROLES), ctrl.listQuestions);
router.post("/", authorize(...WRITE_ROLES), ctrl.createQuestion);

router.get("/:id", authorize(...VIEW_ROLES), ctrl.getQuestion);
router.put("/:id", authorize(...WRITE_ROLES), ctrl.updateQuestion);
router.patch("/:id/status", authorize(...WRITE_ROLES), ctrl.patchStatus);
router.post("/:id/duplicate", authorize(...WRITE_ROLES), ctrl.duplicateQuestion);
router.delete("/:id", authorize(...MANAGE_ROLES), ctrl.softDeleteQuestion);

export default router;
