import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { query, queryOne, pool } from "../config/database.js";
import { ApiResponse } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "../services/audit.service.js";
import bcrypt from "bcryptjs";
import { AppError } from "../middleware/errorHandler.js";
import multer from "multer";
import { uploadFile } from "../config/storage.js";
import { passwordSchema } from "../validators/password.js";

const mouUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

const router = Router();

function getParamAsString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function toCollegeCodeBase(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return (slug || "campus").slice(0, 50);
}

async function buildUniqueCollegeCode(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rowCount: number }> },
  campusName: string,
): Promise<string> {
  const base = toCollegeCodeBase(campusName);

  for (let i = 0; i < 1000; i += 1) {
    const suffix = i === 0 ? "" : `.${i + 1}`;
    const maxBaseLen = 50 - suffix.length;
    const candidate = `${base.slice(0, maxBaseLen)}${suffix}`;
    const exists = await client.query(
      "SELECT 1 FROM colleges WHERE college_code = $1 LIMIT 1",
      [candidate],
    );
    if (exists.rowCount === 0) {
      return candidate;
    }
  }

  throw new AppError(
    "Unable to generate a unique college code. Please try a different campus name.",
    409,
  );
}

const createCampusSchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  tier: z.string().optional(),

  // Enterprise classifications
  category: z.string().optional(),
  institution_type: z.string().optional(),
  region: z.string().optional(),
  naac_grade: z.string().optional(),
  nirf_rank: z.preprocess(
    (val) => (val === null || val === undefined || Number.isNaN(Number(val)) ? undefined : Number(val)),
    z.number().int().optional(),
  ),

  // Optional detail fields
  address: z.string().optional(),
  website: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  internal_notes: z.string().optional(),

  adminName: z.string().min(1, "Admin full name is required"),
  adminEmail: z.string().email("Valid admin email is required"),
  adminPassword: passwordSchema,
});

const updateCampusSchema = createCampusSchema.omit({
  adminName: true,
  adminEmail: true,
  adminPassword: true,
}).partial().extend({
  is_active: z.boolean().optional(),

  // Enterprise fields
  tier: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  institution_type: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  naac_grade: z.string().optional().nullable(),
  nirf_rank: z.preprocess(
    (val) => (val === null || val === undefined || Number.isNaN(Number(val)) ? undefined : Number(val)),
    z.number().int().optional().nullable(),
  ),

  agreement_start_date: z.string().datetime().optional().nullable(),
  agreement_end_date: z.string().datetime().optional().nullable(),
  sla: z.string().optional().nullable(),
  mou_url: z.string().optional().nullable(),
  contract_status: z.string().optional().nullable(),

  eligible_for_hiring: z.boolean().optional(),
  eligible_for_tier1: z.boolean().optional(),
  is_blacklisted: z.boolean().optional(),
  is_suspended: z.boolean().optional(),

  internal_notes: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
});

const createAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid admin email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const bulkActionSchema = z.object({
  action: z.enum(["activate", "suspend", "assign_exam", "delete", "notify"]),
  campusIds: z.array(z.string().uuid()).min(1),
  payload: z.any().optional(),
});

// GET /api/campuses — Restrict to Central Admins
router.get(
  "/",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  async (req, res, next) => {
    try {
      const campuses = await query(`
        SELECT 
          c.*, 
          COUNT(DISTINCT sd.id)::int as student_count,
          (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.college_id = c.id AND u.role IN ('college_admin', 'college'))::int as admin_count,
          (SELECT COUNT(DISTINCT ec.id) FROM exam_colleges ec WHERE ec.college_id = c.id)::int as assessments_count,
          COALESCE((SELECT AVG(ms.final_score) FROM marks_scored ms JOIN student_details s ON s.user_id = ms.student_id WHERE s.college_id = c.id), 0)::float as avg_score,
          COALESCE((SELECT AVG(cl.risk_score) FROM cheating_logs cl JOIN student_details s ON s.user_id = cl.student_id WHERE s.college_id = c.id), 0)::float as avg_risk_score,
          (SELECT COUNT(DISTINCT cl.id) FROM cheating_logs cl JOIN student_details s ON s.user_id = cl.student_id WHERE s.college_id = c.id)::int as incident_count
        FROM colleges c
        LEFT JOIN student_details sd ON sd.college_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC
      `);

      res.json({ success: true, data: campuses });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/campuses
 * Create a new campus (Central Admin/HR only)
 */
router.post(
  "/",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  validate(createCampusSchema),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { name, city, state, tier, adminName, adminEmail, adminPassword } = req.body;

      // Check if email already exists
      const existingUser = await queryOne("SELECT id FROM users WHERE email = $1", [adminEmail]);
      if (existingUser) {
        return res.status(409).json({ success: false, error: "Admin email already in use" });
      }

      const id = uuidv4();
      await client.query("BEGIN");
      const collegeCode = await buildUniqueCollegeCode(client, name);

      // 1. Create Campus (colleges table)
      const campusResult = await client.query(
        `INSERT INTO colleges (
          id, name, city, state, tier, college_code, country, 
          category, institution_type, region, naac_grade, nirf_rank, 
          created_at, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), TRUE)
         RETURNING *`,
        [
          id, name, city, state, tier || null, collegeCode, "India",
          req.body.category || null, req.body.institution_type || null,
          req.body.region || null, req.body.naac_grade || null, req.body.nirf_rank || null
        ]
      );
      const campus = campusResult.rows[0];

      // 2. Create Admin User
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const adminDisplayName = adminName.trim();

      await client.query(
        `INSERT INTO users (role, name, email, password, college_id, is_active, is_profile_complete, must_change_password)
         VALUES ('college_admin', $1, $2, $3, $4, TRUE, TRUE, TRUE)`,
        [adminDisplayName, adminEmail, hashedPassword, id]
      );

      await client.query("COMMIT");

      // 3. Send Invitation Email
      import("../services/email.service.js").then(m => {
        m.sendCampusAdminInvitation({
          adminName: adminDisplayName,
          adminEmail,
          campusName: name,
          temporaryPassword: adminPassword
        }).catch(err => {
          console.error("Failed to send campus admin invitation email:", err);
        });
      });

      // Audit log
      writeAuditLog({
        actor_id: req.user!.userId,
        actor_role: req.user!.role,
        action: "CAMPUS_CREATED",
        target_type: "campus",
        target_id: id,
        reason: `Created campus: ${name} with admin: ${adminEmail}`,
        ip_address: typeof req.ip === "string" ? req.ip : undefined,
      }).catch(() => { });

      res.status(201).json({ success: true, data: campus });
    } catch (err) {
      await client.query("ROLLBACK");
      const dbErr = err as { code?: string; constraint?: string };
      if (dbErr.code === "23505" && dbErr.constraint === "users_email_key") {
        return res
          .status(409)
          .json({ success: false, error: "Admin email already in use" });
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

// Whitelist of columns that can be updated on a campus record.
// Must be kept in sync with updateCampusSchema.
const ALLOWED_CAMPUS_UPDATE_KEYS = new Set([
  "name", "city", "state", "tier", "category", "institution_type", "region",
  "naac_grade", "nirf_rank", "is_active", "agreement_start_date",
  "agreement_end_date", "sla", "mou_url", "contract_status",
  "eligible_for_hiring", "eligible_for_tier1", "is_blacklisted",
  "is_suspended", "internal_notes", "address", "website",
  "contact_email", "contact_phone",
]);

/**
 * GET /api/campuses/:id -> DEEP VIEW
 */
router.get(
  "/:id",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo", "college_admin", "college_staff"),
  async (req, res, next) => {
  try {
    const id = getParamAsString(req.params.id);
    const userRole = req.user?.role?.toLowerCase();
    const collegeId = req.user?.college_id;

    // Multi-tenancy check
    const isCentral = ["super_admin", "admin", "hr", "cxo"].includes(userRole || "");
    if (!isCentral && collegeId !== id) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const campus = await queryOne(`SELECT * FROM colleges WHERE id = $1`, [id]);
    if (!campus) {
      return res.status(404).json({ success: false, error: "Campus not found" });
    }

    // Admins
    const admins = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, 
              (SELECT MAX(created_at) FROM rbac_audit_logs WHERE actor_id = u.id AND action = 'LOGIN') as last_login
       FROM users u WHERE u.college_id = $1 AND u.role IN ('college_admin', 'college') ORDER BY u.created_at ASC`,
      [id]
    );

    // Deep Stats
    const stats = await queryOne(
      `SELECT 
        COUNT(DISTINCT sd.id)::int as student_count,
        COALESCE(AVG(ms.final_score), 0)::float as avg_score,
        COUNT(DISTINCT ec.id)::int as assessments_count,
        COUNT(DISTINCT cl.id)::int as violation_count,
        COALESCE(AVG(cl.risk_score), 0)::float as avg_risk_score
       FROM colleges c
       LEFT JOIN student_details sd ON sd.college_id = c.id
       LEFT JOIN marks_scored ms ON ms.student_id = sd.user_id
       LEFT JOIN cheating_logs cl ON cl.student_id = sd.user_id
       LEFT JOIN exam_colleges ec ON ec.college_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...campus,
        admins,
        stats: stats || {
          student_count: 0,
          avg_score: 0,
          assessments_count: 0,
          violation_count: 0,
          avg_risk_score: 0
        }
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/campuses/:id
 * Update campus details (Central Admin/HR only)
 */
router.put(
  "/:id",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  validate(updateCampusSchema),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      // Whitelist: only allow explicitly permitted columns to prevent mass-assignment
      for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined && ALLOWED_CAMPUS_UPDATE_KEYS.has(key)) {
          updates.push(`${key} = $${paramIdx++}`);
          values.push(value);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: "No fields to update" });
      }

      values.push(id);
      const campus = await queryOne(
        `UPDATE colleges 
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${paramIdx}
         RETURNING *`,
        values
      );

      if (!campus) {
        return res.status(404).json({ success: false, error: "Campus not found" });
      }

      // Audit log
      writeAuditLog({
        actor_id: req.user!.userId,
        actor_role: req.user!.role,
        action: "CAMPUS_UPDATED",
        target_type: "campus",
        target_id: id,
        reason: `Updated campus successfully`,
        ip_address: typeof req.ip === "string" ? req.ip : undefined,
      }).catch(() => { });

      res.json({ success: true, data: campus });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/campuses/:id
 * Soft-delete (Toggle active status) a campus (Central Admin/HR only)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);

      const result = await query(
        "UPDATE colleges SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING is_active",
        [id]
      );

      if (result.length === 0) {
        return res.status(404).json({ success: false, error: "Campus not found" });
      }

      const isActive = result[0].is_active;

      // Audit log
      writeAuditLog({
        actor_id: req.user!.userId,
        actor_role: req.user!.role,
        action: isActive ? "CAMPUS_ACTIVATED" : "CAMPUS_DEACTIVATED",
        target_type: "campus",
        target_id: id,
        reason: `${isActive ? "Activated" : "Deactivated"} campus status`,
        ip_address: typeof req.ip === "string" ? req.ip : undefined,
      }).catch(() => { });

      res.json({
        success: true,
        message: `Campus ${isActive ? "activated" : "deactivated"} successfully`,
        data: { is_active: isActive }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/campuses/:id/admins
 * Add a new admin to an existing campus (Central Admin/HR only)
 */
router.post(
  "/:id/admins",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  validate(createAdminSchema),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);
      const { name, email, password } = req.body;

      // Verify campus exists
      const campus = await queryOne("SELECT id, name FROM colleges WHERE id = $1", [id]);
      if (!campus) {
        return res.status(404).json({ success: false, error: "Campus not found" });
      }

      // Check if email already exists
      const existingUser = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
      if (existingUser) {
        return res.status(409).json({ success: false, error: "Admin email already in use" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const adminDisplayName = name.trim();

      const newAdmin = await queryOne(
        `INSERT INTO users (role, name, email, password, college_id, is_active, is_profile_complete, must_change_password)
         VALUES ('college_admin', $1, $2, $3, $4, TRUE, TRUE, TRUE) RETURNING id, name, email, role, is_active, created_at`,
        [adminDisplayName, email, hashedPassword, id]
      );

      // Send Invitation Email
      import("../services/email.service.js").then(m => {
        m.sendCampusAdminInvitation({
          adminName: adminDisplayName,
          adminEmail: email,
          campusName: campus.name,
          temporaryPassword: password
        }).catch(err => {
          console.error("Failed to send campus admin invitation email:", err);
        });
      });

      // Audit log
      writeAuditLog({
        actor_id: req.user!.userId,
        actor_role: req.user!.role,
        action: "CAMPUS_ADMIN_ADDED",
        target_type: "campus",
        target_id: id,
        reason: `Added admin: ${email} to campus: ${campus.name}`,
        ip_address: typeof req.ip === "string" ? req.ip : undefined,
      }).catch(() => { });

      res.status(201).json({ success: true, data: newAdmin });
    } catch (err) {
      const dbErr = err as { code?: string; constraint?: string };
      if (dbErr.code === "23505" && dbErr.constraint === "users_email_key") {
        return res
          .status(409)
          .json({ success: false, error: "Admin email already in use" });
      }
      next(err);
    }
  }
);

/**
 * POST /api/campuses/bulk-action
 * Perform bulk operations (activate, suspend, delete, etc.)
 */
router.post(
  "/bulk-action",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  validate(bulkActionSchema),
  async (req, res, next) => {
    try {
      const { action, campusIds } = req.body;
      let result;

      if (action === "activate") {
        result = await query(`UPDATE colleges SET is_active = TRUE, is_suspended = FALSE WHERE id = ANY($1)`, [campusIds]);
      } else if (action === "suspend") {
        result = await query(`UPDATE colleges SET is_suspended = TRUE WHERE id = ANY($1)`, [campusIds]);
      } else if (action === "delete") {
        result = await query(`UPDATE colleges SET is_active = FALSE WHERE id = ANY($1)`, [campusIds]);
      } else if (action === "assign_exam") {
        // Assume req.body.payload has { exam_id: string }
        // Iterate over campusIds and create exam_colleges relation where it doesn't already exist
        const examId = req.body.payload?.exam_id;
        if (!examId) throw new AppError("Payload missing exam_id", 400);
        result = await query(
          `INSERT INTO exam_colleges (exam_id, college_id)
           SELECT $1::uuid, campus_id
           FROM UNNEST($2::uuid[]) AS campus_id
           ON CONFLICT DO NOTHING`,
          [examId, campusIds],
        );
      }

      writeAuditLog({
        actor_id: req.user!.userId,
        actor_role: req.user!.role,
        action: `CAMPUS_BULK_${action.toUpperCase()}` as any,
        target_type: "bulk_campuses",
        reason: `Bulk ${action} executed on ${campusIds.length} campuses`,
      }).catch(() => { });

      res.json({ success: true, message: `Bulk ${action} completed successfully`, count: campusIds.length });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/campuses/:id/students
 * Paginated student list for a specific campus
 */
router.get(
  "/:id/students",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo"),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);
      const page = parseInt(String(req.query.page)) || 1;
      const limit = parseInt(String(req.query.limit)) || 30;
      const offset = (page - 1) * limit;
      const search = String(req.query.search || "").trim();

      let whereClauses = ["COALESCE(u.college_id, sd.college_id) = $1"];
      const params: any[] = [id];
      let paramIdx = 2;

      if (search) {
        whereClauses.push(
          `(u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR sd.roll_number ILIKE $${paramIdx})`
        );
        params.push(`%${search}%`);
        paramIdx++;
      }

      const whereSQL = "WHERE " + whereClauses.join(" AND ");

      const students = await query(
        `SELECT u.id, u.name, u.email, u.is_active,
                sd.first_name, sd.last_name, sd.roll_number, sd.degree,
                sd.passing_year, sd.cgpa, sd.percentage,
                COALESCE(ms.final_score, 0)::float as latest_score,
                sd.created_at
         FROM users u
         LEFT JOIN student_details sd ON sd.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT final_score FROM marks_scored WHERE student_id = u.id ORDER BY created_at DESC LIMIT 1
         ) ms ON true
         ${whereSQL}
         ORDER BY u.name ASC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      );

      const countResult = await query(
        `SELECT COUNT(*)::int as total
         FROM users u
         LEFT JOIN student_details sd ON sd.user_id = u.id
         ${whereSQL}`,
        params
      );
      const total = countResult[0]?.total ?? 0;

      res.json({
        success: true,
        data: students,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/campuses/:id/assessments
 * Assessments assigned to this campus
 */
router.get(
  "/:id/assessments",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo"),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);

      const assessments = await query(
        `SELECT e.id, e.title, e.description, e.duration_minutes, e.total_marks,
                e.cutoff_score, e.is_active, e.created_at,
                COUNT(DISTINCT es.student_id)::int as attempts,
                COALESCE(AVG(ms.final_score), 0)::float as avg_score,
                COALESCE(
                  100.0 * COUNT(ms.id) FILTER (WHERE ms.final_score >= e.cutoff_score)
                  / NULLIF(COUNT(ms.id), 0), 0
                )::float as pass_rate
         FROM exam_colleges ec
         JOIN exams e ON e.id = ec.exam_id
         LEFT JOIN exam_sessions es ON es.exam_id = e.id
           AND es.student_id IN (
             SELECT u.id FROM users u
             LEFT JOIN student_details sd ON sd.user_id = u.id
             WHERE COALESCE(u.college_id, sd.college_id) = $1
           )
         LEFT JOIN marks_scored ms ON ms.exam_id = e.id
           AND ms.student_id IN (
             SELECT u.id FROM users u
             LEFT JOIN student_details sd ON sd.user_id = u.id
             WHERE COALESCE(u.college_id, sd.college_id) = $1
           )
         WHERE ec.college_id = $1
         GROUP BY e.id
         ORDER BY e.created_at DESC`,
        [id]
      );

      res.json({ success: true, data: assessments });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/campuses/:id/performance
 * Score distribution + pass rate for students of this campus
 */
router.get(
  "/:id/performance",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo"),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);

      // Score buckets: 0-20, 21-40, 41-60, 61-80, 81-100
      const distribution = await query(
        `SELECT
           width_bucket(ms.final_score, 0, 100, 5) as bucket,
           COUNT(*)::int as count
         FROM marks_scored ms
         JOIN users u ON u.id = ms.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE COALESCE(u.college_id, sd.college_id) = $1
           AND ms.final_score IS NOT NULL
         GROUP BY bucket
         ORDER BY bucket`,
        [id]
      );

      const bucketLabels = ["0–20", "21–40", "41–60", "61–80", "81–100"];
      const dist = bucketLabels.map((label, i) => {
        const row = distribution.find((r: any) => r.bucket === i + 1);
        return { range: label, count: row?.count ?? 0 };
      });

      // Monthly trend for this campus
      const trend = await query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', ms.created_at), 'Mon') as month,
           ROUND(AVG(ms.final_score))::int as avg_score,
           COUNT(*)::int as attempts
         FROM marks_scored ms
         JOIN users u ON u.id = ms.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE COALESCE(u.college_id, sd.college_id) = $1
           AND ms.created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', ms.created_at)
         ORDER BY DATE_TRUNC('month', ms.created_at)`,
        [id]
      );

      // Top performers
      const topPerformers = await query(
        `SELECT u.id, u.name, u.email,
                sd.degree, sd.passing_year,
                ROUND(MAX(ms.final_score))::int as best_score,
                COUNT(ms.id)::int as attempts
         FROM marks_scored ms
         JOIN users u ON u.id = ms.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE COALESCE(u.college_id, sd.college_id) = $1
         GROUP BY u.id, u.name, u.email, sd.degree, sd.passing_year
         ORDER BY best_score DESC
         LIMIT 5`,
        [id]
      );

      res.json({ success: true, data: { distribution: dist, trend, topPerformers } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/campuses/:id/integrity
 * Proctoring incidents for students of this campus
 */
router.get(
  "/:id/integrity",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo"),
  async (req, res, next) => {
    try {
      const id = getParamAsString(req.params.id);

      const incidents = await query(
        `SELECT cl.id, cl.event_type, cl.risk_score, cl.description,
                cl.created_at, u.name as student_name, u.email as student_email,
                e.title as exam_title
         FROM cheating_logs cl
         JOIN users u ON u.id = cl.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         LEFT JOIN exams e ON e.id = cl.exam_id
         WHERE COALESCE(u.college_id, sd.college_id) = $1
         ORDER BY cl.created_at DESC
         LIMIT 50`,
        [id]
      );

      const summary = await query(
        `SELECT
           COUNT(*)::int as total_incidents,
           COUNT(*) FILTER (WHERE risk_score >= 70)::int as critical,
           COUNT(*) FILTER (WHERE risk_score >= 40 AND risk_score < 70)::int as moderate,
           COUNT(*) FILTER (WHERE risk_score < 40)::int as low,
           COALESCE(ROUND(AVG(risk_score))::int, 0) as avg_risk_score
         FROM cheating_logs cl
         JOIN users u ON u.id = cl.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE COALESCE(u.college_id, sd.college_id) = $1`,
        [id]
      );

      res.json({
        success: true,
        data: { incidents, summary: summary[0] ?? { total_incidents: 0, critical: 0, moderate: 0, low: 0, avg_risk_score: 0 } },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
