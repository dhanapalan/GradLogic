import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { v4 as uuidv4 } from "uuid";
import * as mockPaymentGateway from "../services/mockPaymentGateway.service.js";

const router = Router();

// ── Subscription Plans ────────────────────────────────────────────────────────

/**
 * GET /api/billing/plans
 * List all active subscription plans (public)
 */
router.get("/plans", async (req, res, next) => {
  try {
    const plans = await query(`
      SELECT id, name, description, tier, price_per_month, price_per_year,
             max_students, max_drives, max_assessments, features
      FROM subscription_plans
      WHERE is_active = TRUE
      ORDER BY price_per_month ASC
    `);
    res.json({ success: true, data: plans });
  } catch (err: unknown) {
    // Table may be missing until docker/init-db/32-billing-subscription-plans.sql runs
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return res.json({ success: true, data: [] });
    }
    next(err);
  }
});

/**
 * GET /api/billing/plans/:id
 * Get a specific plan
 */
router.get("/plans/:id", async (req, res, next) => {
  try {
    const plan = await queryOne(`
      SELECT * FROM subscription_plans WHERE id = $1
    `, [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// ── College Subscriptions ────────────────────────────────────────────────────

/**
 * GET /api/billing/subscriptions
 * Get current college subscription (college_admin only)
 */
router.get(
  "/subscriptions",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const collegeId = user.college_id;

      if (!collegeId) {
        return res.status(403).json({ success: false, error: "No college context" });
      }

      const subscription = await queryOne(`
        SELECT s.*, p.name as plan_name, p.tier
        FROM subscriptions s
        JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.college_id = $1 AND s.status IN ('active', 'paused')
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [collegeId]);

      if (!subscription) {
        return res.status(404).json({ success: false, error: "No active subscription" });
      }

      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/subscribe
 * Create a new subscription for a college
 */
router.post(
  "/subscribe",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  validate(
    z.object({
      plan_id: z.string().uuid("Invalid plan ID"),
      billing_cycle: z.enum(["monthly", "annual"]).default("monthly"),
      payment_method: z.string().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const collegeId = user.college_id;
      const { plan_id, billing_cycle } = req.body;

      if (!collegeId) {
        return res.status(403).json({ success: false, error: "No college context" });
      }

      // Check plan exists
      const plan = await queryOne(`
        SELECT * FROM subscription_plans WHERE id = $1 AND is_active = TRUE
      `, [plan_id]);
      if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });

      // Check no active subscription exists
      const existing = await queryOne(`
        SELECT id FROM subscriptions
        WHERE college_id = $1 AND status IN ('active', 'paused')
      `, [collegeId]);
      if (existing) {
        return res.status(400).json({ success: false, error: "College already has active subscription" });
      }

      const subscriptionId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + (billing_cycle === "annual" ? 12 : 1));

      const currentAmount = billing_cycle === "annual"
        ? plan.price_per_year || (plan.price_per_month * 12)
        : plan.price_per_month;

      const subscription = await queryOne(`
        INSERT INTO subscriptions
        (id, college_id, plan_id, status, billing_cycle, current_amount, expires_at, auto_renew)
        VALUES ($1, $2, $3, 'active', $4, $5, $6, TRUE)
        RETURNING *
      `, [subscriptionId, collegeId, plan_id, billing_cycle, currentAmount, expiresAt]);

      // Create first invoice
      const invoiceNumber = `INV-${collegeId.slice(0, 8)}-${Date.now()}`;
      await queryOne(`
        INSERT INTO invoices
        (subscription_id, college_id, invoice_number, amount_due, total, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
      `, [subscriptionId, collegeId, invoiceNumber, currentAmount, currentAmount]);

      res.status(201).json({
        success: true,
        data: subscription,
        message: "Subscription created. Please complete payment."
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/billing/subscriptions/:id
 * Update subscription (pause/cancel/renew)
 */
router.put(
  "/subscriptions/:id",
  authenticate,
  authorize("college_admin", "college", "super_admin"),
  validate(
    z.object({
      action: z.enum(["pause", "resume", "cancel"]),
    })
  ),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const user = (req as any).user;

      // Verify ownership
      const subscription = await queryOne(`
        SELECT s.* FROM subscriptions s
        WHERE s.id = $1 AND s.college_id = $2
      `, [id, user.college_id]);

      if (!subscription) {
        return res.status(403).json({ success: false, error: "Subscription not found or access denied" });
      }

      let newStatus = subscription.status;
      let cancelledAt = null;

      if (action === "pause") newStatus = "paused";
      else if (action === "resume") newStatus = "active";
      else if (action === "cancel") {
        newStatus = "cancelled";
        cancelledAt = "NOW()";
      }

      const updated = await queryOne(`
        UPDATE subscriptions
        SET status = $1, cancelled_at = ${cancelledAt || "cancelled_at"}, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newStatus, id]);

      res.json({ success: true, data: updated, message: `Subscription ${action}ed` });
    } catch (err) {
      next(err);
    }
  }
);

// ── Invoices ─────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/invoices
 * List invoices for a college
 */
router.get(
  "/invoices",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const collegeId = user.college_id;
      const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
      const limit = parseInt(String(req.query.limit ?? "20"), 10) || 20;
      const offset = (page - 1) * limit;

      if (!collegeId) {
        return res.status(403).json({ success: false, error: "No college context" });
      }

      const [invoices, countResult] = await Promise.all([
        query(`
          SELECT id, invoice_number, amount_due, amount_paid, total, status,
                 issued_date, due_date, paid_date
          FROM invoices
          WHERE college_id = $1
          ORDER BY issued_date DESC
          LIMIT $2 OFFSET $3
        `, [collegeId, limit, offset]),
        queryOne<{ count: number }>(`
          SELECT COUNT(*)::int as count FROM invoices WHERE college_id = $1
        `, [collegeId]),
      ]);

      res.json({
        success: true,
        data: invoices,
        meta: {
          page,
          limit,
          total: countResult?.count ?? 0,
          totalPages: Math.ceil((countResult?.count ?? 0) / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/billing/invoices/:id
 * Get a specific invoice
 */
router.get(
  "/invoices/:id",
  authenticate,
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const invoice = await queryOne(`
        SELECT i.* FROM invoices i
        WHERE i.id = $1 AND i.college_id = $2
      `, [req.params.id, user.college_id]);

      if (!invoice) {
        return res.status(404).json({ success: false, error: "Invoice not found" });
      }

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/invoices/:id/download
 * Download invoice as PDF (placeholder)
 */
router.post(
  "/invoices/:id/download",
  authenticate,
  async (req, res, next) => {
    try {
      const invoice = await queryOne(`
        SELECT * FROM invoices WHERE id = $1
      `, [req.params.id]);

      if (!invoice) {
        return res.status(404).json({ success: false, error: "Invoice not found" });
      }

      // TODO: Generate PDF using pdfkit or similar
      res.json({ success: true, message: "PDF generation not yet implemented" });
    } catch (err) {
      next(err);
    }
  }
);

// ── Billing Contacts ─────────────────────────────────────────────────────────

/**
 * GET /api/billing/contacts
 * List billing contacts for a college
 */
router.get(
  "/contacts",
  authenticate,
  authorize("college_admin", "college", "super_admin"),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const collegeId = user.college_id;

      if (!collegeId) {
        return res.status(403).json({ success: false, error: "No college context" });
      }

      const contacts = await query(`
        SELECT id, name, email, phone, designation, city, state, country,
               gst_number, is_primary, is_active, created_at
        FROM billing_contacts
        WHERE college_id = $1 AND is_active = TRUE
        ORDER BY is_primary DESC, name ASC
      `, [collegeId]);

      res.json({ success: true, data: contacts });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/contacts
 * Add a new billing contact
 */
router.post(
  "/contacts",
  authenticate,
  authorize("college_admin", "college"),
  validate(
    z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      designation: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      gst_number: z.string().optional(),
      is_primary: z.boolean().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const collegeId = user.college_id;
      const { name, email, phone, designation, city, state, country, gst_number, is_primary } = req.body;

      if (!collegeId) {
        return res.status(403).json({ success: false, error: "No college context" });
      }

      const contactId = uuidv4();

      const contact = await queryOne(`
        INSERT INTO billing_contacts
        (id, college_id, name, email, phone, designation, city, state, country, gst_number, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [contactId, collegeId, name, email, phone || null, designation || null, city || null, state || null, country || null, gst_number || null, is_primary || false]);

      res.status(201).json({ success: true, data: contact });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/billing/contacts/:id
 * Update a billing contact
 */
router.put(
  "/contacts/:id",
  authenticate,
  authorize("college_admin", "college"),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { name, email, phone, designation, city, state, country, gst_number, is_primary } = req.body;

      const contact = await queryOne(`
        SELECT * FROM billing_contacts WHERE id = $1 AND college_id = $2
      `, [id, user.college_id]);

      if (!contact) {
        return res.status(404).json({ success: false, error: "Contact not found" });
      }

      const updated = await queryOne(`
        UPDATE billing_contacts
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            phone = COALESCE($3, phone),
            designation = COALESCE($4, designation),
            city = COALESCE($5, city),
            state = COALESCE($6, state),
            country = COALESCE($7, country),
            gst_number = COALESCE($8, gst_number),
            is_primary = COALESCE($9, is_primary),
            updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `, [name || null, email || null, phone || null, designation || null, city || null, state || null, country || null, gst_number || null, is_primary || null, id]);

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ── Per-Student Fees (₹500 / student / academic year) ────────────────────────

const PER_STUDENT_ANNUAL_FEE = 500;

/** Resolve the college the caller is billing for. College admins are locked to
 *  their own college; super_admin/hr may pass ?college_id=. */
function resolveCollegeId(req: any): string | null {
  const user = req.user;
  if (user?.role === "super_admin" || user?.role === "hr" || user?.role === "admin") {
    return String(req.query.college_id || req.body?.college_id || "") || user?.college_id || null;
  }
  return user?.college_id || null;
}

function currentAcademicYear(): string {
  // Indian academic year: June–May (e.g. July 2026 → '2026-27')
  const now = new Date();
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * POST /api/billing/student-fees/generate
 * Create pending ₹500 fee records for every active student of the college
 * that doesn't already have one for the academic year.
 */
router.post(
  "/student-fees/generate",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  async (req, res, next) => {
    try {
      const collegeId = resolveCollegeId(req);
      if (!collegeId) return res.status(403).json({ success: false, error: "No college context" });
      const academicYear = String(req.body?.academic_year || currentAcademicYear());

      const inserted = await query(
        `INSERT INTO student_payments (student_id, college_id, department, academic_year, amount)
         SELECT u.id, u.college_id, u.department, $1, $2
         FROM users u
         WHERE u.role = 'student' AND u.is_active = TRUE AND u.college_id = $3
         ON CONFLICT (student_id, academic_year) DO NOTHING
         RETURNING id`,
        [academicYear, PER_STUDENT_ANNUAL_FEE, collegeId]
      );

      res.status(201).json({
        success: true,
        message: `Generated ${inserted.length} fee record(s) for ${academicYear}`,
        data: { generated: inserted.length, academic_year: academicYear, amount_per_student: PER_STUDENT_ANNUAL_FEE },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/billing/student-fees/summary
 * Department-wise rollup: students, paid, pending, amount collected.
 */
router.get(
  "/student-fees/summary",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  async (req, res, next) => {
    try {
      const collegeId = resolveCollegeId(req);
      if (!collegeId) return res.status(403).json({ success: false, error: "No college context" });
      const academicYear = String(req.query.academic_year || currentAcademicYear());

      const [departments, totals] = await Promise.all([
        query(
          `SELECT COALESCE(department, 'Unassigned') AS department,
                  COUNT(*)::int AS total_students,
                  COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
                  COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                  COUNT(*) FILTER (WHERE status = 'waived')::int AS waived,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS collected,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS outstanding
           FROM student_payments
           WHERE college_id = $1 AND academic_year = $2
           GROUP BY COALESCE(department, 'Unassigned')
           ORDER BY department`,
          [collegeId, academicYear]
        ),
        queryOne<{ total: number; paid: number; pending: number; collected: string; outstanding: string }>(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
                  COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS collected,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS outstanding
           FROM student_payments
           WHERE college_id = $1 AND academic_year = $2`,
          [collegeId, academicYear]
        ),
      ]);

      res.json({
        success: true,
        data: {
          academic_year: academicYear,
          fee_per_student: PER_STUDENT_ANNUAL_FEE,
          totals,
          departments,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/billing/student-fees
 * Student-level fee list. Filters: department, status, search, academic_year.
 */
router.get(
  "/student-fees",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  async (req, res, next) => {
    try {
      const collegeId = resolveCollegeId(req);
      if (!collegeId) return res.status(403).json({ success: false, error: "No college context" });
      const academicYear = String(req.query.academic_year || currentAcademicYear());
      const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
      const limit = parseInt(String(req.query.limit ?? "20"), 10) || 20;
      const offset = (page - 1) * limit;

      const conditions: string[] = ["sp.college_id = $1", "sp.academic_year = $2"];
      const params: unknown[] = [collegeId, academicYear];
      let idx = 3;

      if (req.query.department) {
        conditions.push(`COALESCE(sp.department, 'Unassigned') = $${idx++}`);
        params.push(String(req.query.department));
      }
      if (req.query.status) {
        conditions.push(`sp.status = $${idx++}`);
        params.push(String(req.query.status));
      }
      if (req.query.search) {
        conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
        params.push(`%${String(req.query.search)}%`);
        idx++;
      }

      const where = conditions.join(" AND ");
      const countParams = [...params];
      params.push(limit, offset);

      const [rows, countResult] = await Promise.all([
        query(
          `SELECT sp.id, sp.student_id, sp.department, sp.academic_year, sp.amount,
                  sp.status, sp.paid_at, sp.payment_method, sp.payment_ref,
                  u.name AS student_name, u.email AS student_email
           FROM student_payments sp
           JOIN users u ON u.id = sp.student_id
           WHERE ${where}
           ORDER BY u.name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          params
        ),
        queryOne<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM student_payments sp
           JOIN users u ON u.id = sp.student_id
           WHERE ${where}`,
          countParams
        ),
      ]);

      res.json({
        success: true,
        data: rows,
        meta: {
          page,
          limit,
          total: countResult?.count ?? 0,
          totalPages: Math.ceil((countResult?.count ?? 0) / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/student-fees/:id/pay
 * Record an OFFLINE payment against a student fee (cash/UPI/card/bank
 * transfer collected in person by the college). Kept as a fallback path —
 * the primary path going forward is the student paying directly online via
 * /student-fees/:id/create-order + /verify-payment below.
 */
router.post(
  "/student-fees/:id/pay",
  authenticate,
  authorize("college_admin", "college", "super_admin", "hr"),
  validate(
    z.object({
      payment_method: z.enum(["cash", "upi", "card", "bank_transfer"]).default("cash"),
      payment_ref: z.string().max(100).optional(),
      notes: z.string().max(500).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const collegeId = resolveCollegeId(req);
      if (!collegeId) return res.status(403).json({ success: false, error: "No college context" });
      const feeId = String(req.params.id);
      const { payment_method, payment_ref, notes } = req.body as {
        payment_method: string; payment_ref?: string; notes?: string;
      };
      const userId = (req as any).user?.userId;

      const updated = await queryOne(
        `UPDATE student_payments
         SET status = 'paid', paid_at = NOW(), payment_method = $1,
             payment_ref = $2, notes = COALESCE($3, notes), recorded_by = $4, updated_at = NOW()
         WHERE id = $5 AND college_id = $6 AND status = 'pending'
         RETURNING id, student_id, amount, status, paid_at, payment_method`,
        [payment_method, payment_ref || null, notes || null, userId, feeId, collegeId]
      );

      if (!updated) {
        return res.status(404).json({ success: false, error: "Fee record not found or already settled" });
      }
      res.json({ success: true, data: updated, message: "Payment recorded" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/billing/my-fees
 * Self-service: the logged-in student's own fee records across all academic
 * years, plus a small summary. Pending fees can be paid directly via
 * /student-fees/:id/create-order + /verify-payment below (mock gateway for
 * now); colleges can also still record an offline payment as a fallback.
 */
router.get(
  "/my-fees",
  authenticate,
  authorize("student"),
  async (req, res, next) => {
    try {
      const studentId = (req as any).user?.userId;
      if (!studentId) return res.status(403).json({ success: false, error: "No student context" });

      const rows = await query(
        `SELECT sp.id, sp.academic_year, sp.department, sp.amount, sp.status,
                sp.paid_at, sp.payment_method, sp.payment_ref,
                c.name AS college_name
         FROM student_payments sp
         LEFT JOIN colleges c ON c.id = sp.college_id
         WHERE sp.student_id = $1
         ORDER BY sp.academic_year DESC`,
        [studentId]
      );

      const current = rows.find((r: any) => r.academic_year === currentAcademicYear()) || null;
      const totalPaid = rows
        .filter((r: any) => r.status === "paid")
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

      res.json({
        success: true,
        data: {
          fee_per_student: PER_STUDENT_ANNUAL_FEE,
          current_academic_year: currentAcademicYear(),
          current,
          total_paid: totalPaid,
          history: rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── Direct Student Payment (MOCK gateway) ────────────────────────────────────
// Mirrors a Razorpay-style order-create → checkout → verify flow so the real
// gateway can be dropped in later without changing the route shape or the
// frontend call sites. See services/mockPaymentGateway.service.ts for the
// TODOs to address before this goes to production with real money.

/**
 * POST /api/billing/student-fees/:id/create-order
 * Student-initiated: create a (mock) payment order for one of the caller's
 * own pending fee records. Returns an order the client would normally hand
 * to a checkout widget; here it's just echoed back for the mock flow.
 */
router.post(
  "/student-fees/:id/create-order",
  authenticate,
  authorize("student"),
  async (req, res, next) => {
    try {
      const studentId = (req as any).user?.userId;
      if (!studentId) return res.status(403).json({ success: false, error: "No student context" });

      const fee = await queryOne<{ id: string; amount: string; status: string }>(
        `SELECT id, amount, status FROM student_payments WHERE id = $1 AND student_id = $2`,
        [req.params.id, studentId]
      );

      if (!fee) return res.status(404).json({ success: false, error: "Fee record not found" });
      if (fee.status !== "pending") {
        return res.status(400).json({ success: false, error: `Fee is already ${fee.status}` });
      }

      const order = mockPaymentGateway.createOrder({
        amount: Number(fee.amount),
        receipt: fee.id,
      });

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/student-fees/:id/verify-payment
 * Student-initiated: confirm a (mock) payment and mark the fee paid. A real
 * integration would verify a signature/webhook here instead of trusting the
 * client-supplied payment_id.
 */
router.post(
  "/student-fees/:id/verify-payment",
  authenticate,
  authorize("student"),
  validate(
    z.object({
      order_id: z.string().min(1),
      payment_id: z.string().min(1),
      signature: z.string().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const studentId = (req as any).user?.userId;
      if (!studentId) return res.status(403).json({ success: false, error: "No student context" });
      const { order_id, payment_id, signature } = req.body as {
        order_id: string; payment_id: string; signature?: string;
      };

      const result = mockPaymentGateway.verifyPayment({ order_id, payment_id, signature });
      if (!result.verified) {
        throw new AppError("Payment verification failed", 402);
      }

      const updated = await queryOne(
        `UPDATE student_payments
         SET status = 'paid', paid_at = NOW(), payment_method = 'online',
             payment_ref = $1, updated_at = NOW()
         WHERE id = $2 AND student_id = $3 AND status = 'pending'
         RETURNING id, student_id, amount, status, paid_at, payment_method, payment_ref`,
        [payment_id, req.params.id, studentId]
      );

      if (!updated) {
        return res.status(404).json({ success: false, error: "Fee record not found or already settled" });
      }

      res.json({ success: true, data: updated, message: "Payment successful" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
