import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import * as collegeProfile from "../services/collegeProfile.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const VIEW_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "placement_cell",
  "instructor",
  "super_admin",
  "admin",
  "hr",
] as const;

const EDIT_ROLES = ["college_admin", "college", "super_admin", "admin", "hr"] as const;

router.use(authenticate);

let profileColumnsReady = false;
async function ensureSchema() {
  if (profileColumnsReady) return;
  await collegeProfile.ensureCollegeProfileColumns();
  profileColumnsReady = true;
}

/**
 * GET /api/college/profile
 * View own college master profile.
 */
router.get("/", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    await ensureSchema();
    if (!collegeProfile.canViewCollegeProfile(req.user?.role)) {
      throw new AppError("Access denied.", 403);
    }
    const data = await collegeProfile.getCollegeProfile(req.user?.college_id);
    const canEdit = collegeProfile.canEditCollegeProfile(req.user?.role);
    res.json({ success: true, data: { ...data, can_edit: canEdit } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/college/profile
 * Update own college profile (College / Org Admin only).
 */
router.put("/", authorize(...EDIT_ROLES), async (req, res, next) => {
  try {
    await ensureSchema();
    if (!collegeProfile.canEditCollegeProfile(req.user?.role)) {
      throw new AppError("You do not have permission to edit the college profile.", 403);
    }
    const data = await collegeProfile.updateCollegeProfile(
      req.user?.college_id,
      req.body ?? {},
      {
        id: req.user!.userId,
        role: req.user!.role,
        ip: typeof req.ip === "string" ? req.ip : undefined,
      }
    );
    res.json({ success: true, data: { ...data, can_edit: true }, message: "College profile updated" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/college/profile/logo
 * Upload / replace college logo (image only).
 */
router.post(
  "/logo",
  authorize(...EDIT_ROLES),
  upload.single("logo"),
  async (req, res, next) => {
    try {
      await ensureSchema();
      if (!collegeProfile.canEditCollegeProfile(req.user?.role)) {
        throw new AppError("You do not have permission to edit the college profile.", 403);
      }
      const data = await collegeProfile.uploadCollegeLogo(
        req.user?.college_id,
        req.file,
        {
          id: req.user!.userId,
          role: req.user!.role,
          ip: typeof req.ip === "string" ? req.ip : undefined,
        }
      );
      res.json({
        success: true,
        data: { ...data, can_edit: true },
        message: "College logo updated",
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
