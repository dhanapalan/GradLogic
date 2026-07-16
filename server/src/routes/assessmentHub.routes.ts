import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getAssessmentHubDashboard } from "../services/assessmentHub.service.js";
import { getAssessmentHubAnalytics } from "../services/assessmentHubAnalytics.service.js";
import { getAssessmentPipelineHealth } from "../services/assessmentPipeline.service.js";
import { listRecentInsights } from "../services/assessmentIntegration.service.js";
import {
  getAttemptEvaluation,
  getEvaluationOverview,
  listRecentEvaluations,
} from "../services/assessmentEvaluation.service.js";
import * as certs from "../services/certificates.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer", "instructor"] as const;

router.use(authenticate);
router.use(authorize(...ADMIN));

router.get("/dashboard", async (req, res, next) => {
  try {
    const data = await getAssessmentHubDashboard({
      domain: (req.query.domain as string) || undefined,
      status: (req.query.status as string) || undefined,
      drive_type: (req.query.drive_type as string) || undefined,
      created_by: (req.query.created_by as string) || undefined,
      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/pipeline", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getAssessmentPipelineHealth() });
  } catch (err) {
    next(err);
  }
});

router.get("/insights/recent", async (req, res, next) => {
  try {
    const data = await listRecentInsights(
      req.query.limit ? Number(req.query.limit) : 20
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/analytics", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getAssessmentHubAnalytics() });
  } catch (err) {
    next(err);
  }
});

router.get("/evaluation/overview", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getEvaluationOverview() });
  } catch (err) {
    next(err);
  }
});

router.get("/evaluation/attempts", async (req, res, next) => {
  try {
    const data = await listRecentEvaluations({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      driveId: (req.query.drive_id as string) || undefined,
      search: (req.query.search as string) || undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/evaluation/attempts/:sessionId", async (req, res, next) => {
  try {
    const enrichAi = req.query.ai !== "0";
    const data = await getAttemptEvaluation(req.params.sessionId, { enrichAi });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Certificates ─────────────────────────────────────────────────────────────

router.get("/certificates/meta", async (_req, res, next) => {
  try {
    res.json({ success: true, data: certs.certificateTypeMeta() });
  } catch (err) {
    next(err);
  }
});

router.get("/certificates/options", async (_req, res, next) => {
  try {
    const [practiceDrives, courses, tracks] = await Promise.all([
      certs.listPracticeDrivesForCert(),
      certs.listCoursesForCert(),
      certs.listTracksForCert(),
    ]);
    res.json({ success: true, data: { practiceDrives, courses, tracks } });
  } catch (err) {
    next(err);
  }
});

router.get("/certificates/students", async (req, res, next) => {
  try {
    const data = await certs.searchStudentsForCert(
      (req.query.q as string) || "",
      req.query.limit ? Number(req.query.limit) : 20
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/certificates", async (req, res, next) => {
  try {
    const data = await certs.listCertificates({
      search: (req.query.search as string) || undefined,
      certType: (req.query.cert_type as string) || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/certificates",
  validate(
    z.object({
      cert_type: z.enum([
        "practice_completion",
        "course_completion",
        "placement_track_completion",
      ]),
      student_id: z.string().uuid(),
      course_id: z.string().uuid().optional(),
      drive_id: z.string().uuid().optional(),
      path_id: z.string().uuid().optional(),
      title: z.string().min(1).max(240).optional(),
      force: z.boolean().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await certs.generateCertificate(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/certificates/:id/pdf", async (req, res, next) => {
  try {
    const { buffer, filename } = await certs.renderCertificatePdf(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get("/certificates/:id", async (req, res, next) => {
  try {
    const data = await certs.getCertificate(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
