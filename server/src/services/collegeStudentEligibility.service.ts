/**
 * Sprint 2.5 — Placement Eligibility management.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";

const DEFAULT_MIN_CGPA = 6.0;
const DEFAULT_MAX_BACKLOGS = 0;

export interface EligibilityRules {
  min_cgpa: number;
  max_active_backlogs: number;
}

export interface RuleCheck {
  cgpa_ok: boolean;
  backlog_ok: boolean;
  rule_eligible: boolean;
  cgpa: number | null;
  active_backlogs: number;
  min_cgpa: number;
  max_active_backlogs: number;
  messages: string[];
}

export interface EligibilityState {
  placement_eligible: boolean;
  reason: string | null;
  eligibility_date: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verification_date: string | null;
  active_backlogs: number;
  manual_override: boolean;
  cgpa: number | null;
  rules: EligibilityRules;
  rule_check: RuleCheck;
}

export interface EligibilityHistoryRow {
  id: string;
  previous_eligible: boolean | null;
  new_eligible: boolean;
  previous_active_backlogs: number | null;
  new_active_backlogs: number | null;
  previous_cgpa: number | null;
  new_cgpa: number | null;
  change_source: string;
  reason: string | null;
  manual_override: boolean;
  verified_by: string | null;
  verified_by_name: string | null;
  created_at: string;
}

let schemaReady = false;

export async function ensureEligibilitySchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    ALTER TABLE student_details
      ADD COLUMN IF NOT EXISTS eligibility_reason TEXT,
      ADD COLUMN IF NOT EXISTS eligibility_date DATE,
      ADD COLUMN IF NOT EXISTS eligibility_verified_by UUID,
      ADD COLUMN IF NOT EXISTS eligibility_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS active_backlogs INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS eligibility_manual_override BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await query(`
    ALTER TABLE colleges
      ADD COLUMN IF NOT EXISTS min_placement_cgpa NUMERIC(4,2) DEFAULT 6.0,
      ADD COLUMN IF NOT EXISTS max_active_backlogs INT DEFAULT 0
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS student_eligibility_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id),
      user_id UUID NOT NULL REFERENCES users(id),
      previous_eligible BOOLEAN,
      new_eligible BOOLEAN NOT NULL,
      previous_active_backlogs INT,
      new_active_backlogs INT,
      previous_cgpa NUMERIC(4,2),
      new_cgpa NUMERIC(4,2),
      change_source VARCHAR(40) NOT NULL DEFAULT 'manual',
      reason TEXT,
      manual_override BOOLEAN NOT NULL DEFAULT FALSE,
      verified_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_eligibility_hist_user
      ON student_eligibility_history (user_id, created_at DESC)
  `).catch(() => {});
  schemaReady = true;
}

async function loadRules(collegeId: string): Promise<EligibilityRules> {
  const row = await queryOne<{ min_placement_cgpa: string | null; max_active_backlogs: number | null }>(
    `SELECT min_placement_cgpa::text, max_active_backlogs FROM colleges WHERE id = $1`,
    [collegeId]
  ).catch(() => null);
  const min = row?.min_placement_cgpa != null ? Number(row.min_placement_cgpa) : DEFAULT_MIN_CGPA;
  const max =
    row?.max_active_backlogs != null ? Number(row.max_active_backlogs) : DEFAULT_MAX_BACKLOGS;
  return {
    min_cgpa: Number.isFinite(min) ? min : DEFAULT_MIN_CGPA,
    max_active_backlogs: Number.isFinite(max) ? max : DEFAULT_MAX_BACKLOGS,
  };
}

function evaluateRules(
  cgpa: number | null,
  activeBacklogs: number,
  rules: EligibilityRules
): RuleCheck {
  const messages: string[] = [];
  const cgpa_ok = cgpa != null && cgpa >= rules.min_cgpa;
  const backlog_ok = activeBacklogs <= rules.max_active_backlogs;

  if (cgpa == null) messages.push(`CGPA missing (minimum ${rules.min_cgpa})`);
  else if (!cgpa_ok) messages.push(`CGPA ${cgpa} below minimum ${rules.min_cgpa}`);
  else messages.push(`CGPA ${cgpa} meets minimum ${rules.min_cgpa}`);

  if (!backlog_ok) {
    messages.push(
      `Active backlogs ${activeBacklogs} exceed allowed ${rules.max_active_backlogs}`
    );
  } else {
    messages.push(
      `Active backlogs ${activeBacklogs} within limit ${rules.max_active_backlogs}`
    );
  }

  return {
    cgpa_ok,
    backlog_ok,
    rule_eligible: cgpa_ok && backlog_ok,
    cgpa,
    active_backlogs: activeBacklogs,
    min_cgpa: rules.min_cgpa,
    max_active_backlogs: rules.max_active_backlogs,
    messages,
  };
}

async function assertStudent(collegeId: string, userId: string) {
  const row = await queryOne<{
    user_id: string;
    eligible_for_hiring: boolean;
    eligibility_reason: string | null;
    eligibility_date: string | null;
    eligibility_verified_by: string | null;
    verified_by_name: string | null;
    eligibility_verified_at: string | null;
    active_backlogs: number;
    eligibility_manual_override: boolean;
    cgpa: number | null;
  }>(
    `SELECT u.id AS user_id,
            COALESCE(sd.eligible_for_hiring, FALSE) AS eligible_for_hiring,
            sd.eligibility_reason,
            sd.eligibility_date::text,
            sd.eligibility_verified_by,
            v.name AS verified_by_name,
            sd.eligibility_verified_at::text,
            COALESCE(sd.active_backlogs, 0) AS active_backlogs,
            COALESCE(sd.eligibility_manual_override, FALSE) AS eligibility_manual_override,
            sd.cgpa::float AS cgpa
     FROM users u
     JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN users v ON v.id = sd.eligibility_verified_by
     WHERE u.id = $1
       AND COALESCE(u.college_id, sd.college_id) = $2
       AND LOWER(u.role::text) = 'student'
       AND u.deleted_at IS NULL`,
    [userId, collegeId]
  );
  if (!row) throw new AppError("Student not found in this college.", 404);
  return row;
}

export async function getEligibility(collegeId: string, userId: string) {
  await ensureEligibilitySchema();
  const student = await assertStudent(collegeId, userId);
  const rules = await loadRules(collegeId);
  const rule_check = evaluateRules(student.cgpa, student.active_backlogs, rules);

  const state: EligibilityState = {
    placement_eligible: student.eligible_for_hiring,
    reason: student.eligibility_reason,
    eligibility_date: student.eligibility_date,
    verified_by: student.eligibility_verified_by,
    verified_by_name: student.verified_by_name,
    verification_date: student.eligibility_verified_at,
    active_backlogs: student.active_backlogs,
    manual_override: student.eligibility_manual_override,
    cgpa: student.cgpa,
    rules,
    rule_check,
  };

  return state;
}

export async function getEligibilityHistory(collegeId: string, userId: string) {
  await ensureEligibilitySchema();
  await assertStudent(collegeId, userId);

  const rows = await query<EligibilityHistoryRow>(
    `SELECT h.id,
            h.previous_eligible,
            h.new_eligible,
            h.previous_active_backlogs,
            h.new_active_backlogs,
            h.previous_cgpa::float AS previous_cgpa,
            h.new_cgpa::float AS new_cgpa,
            h.change_source,
            h.reason,
            h.manual_override,
            h.verified_by,
            v.name AS verified_by_name,
            h.created_at::text
     FROM student_eligibility_history h
     LEFT JOIN users v ON v.id = h.verified_by
     WHERE h.user_id = $1 AND h.college_id = $2
     ORDER BY h.created_at DESC
     LIMIT 50`,
    [userId, collegeId]
  );

  return { history: rows };
}

export async function setEligibility(
  collegeId: string,
  userId: string,
  input: {
    eligible: boolean;
    reason?: string | null;
    active_backlogs?: number | null;
    eligibility_date?: string | null;
    change_source?: string;
  },
  actor: { id: string; role: string; ip?: string; name?: string }
) {
  await ensureEligibilitySchema();
  const student = await assertStudent(collegeId, userId);
  const rules = await loadRules(collegeId);

  const nextBacklogs =
    input.active_backlogs != null && input.active_backlogs !== undefined
      ? Math.max(0, Math.floor(Number(input.active_backlogs)))
      : student.active_backlogs;

  if (!Number.isFinite(nextBacklogs) || nextBacklogs < 0) {
    throw new AppError("active_backlogs must be a non-negative integer.", 400);
  }

  const reason = (input.reason || "").trim();
  if (!reason) {
    throw new AppError("Reason is required when updating eligibility.", 400);
  }

  const rule_check = evaluateRules(student.cgpa, nextBacklogs, rules);
  const manual_override = input.eligible !== rule_check.rule_eligible;

  if (manual_override && input.eligible && !reason) {
    throw new AppError("Reason is required for manual override.", 400);
  }

  const eligibilityDate =
    input.eligibility_date?.trim() || new Date().toISOString().slice(0, 10);

  const prevEligible = student.eligible_for_hiring;
  const prevBacklogs = student.active_backlogs;

  await query(
    `UPDATE student_details
     SET eligible_for_hiring = $1,
         eligibility_reason = $2,
         eligibility_date = $3::date,
         eligibility_verified_by = $4,
         eligibility_verified_at = NOW(),
         active_backlogs = $5,
         eligibility_manual_override = $6
     WHERE user_id = $7`,
    [
      input.eligible,
      reason,
      eligibilityDate,
      actor.id,
      nextBacklogs,
      manual_override,
      userId,
    ]
  );

  await query(
    `INSERT INTO student_eligibility_history
       (college_id, user_id, previous_eligible, new_eligible,
        previous_active_backlogs, new_active_backlogs, previous_cgpa, new_cgpa,
        change_source, reason, manual_override, verified_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      collegeId,
      userId,
      prevEligible,
      input.eligible,
      prevBacklogs,
      nextBacklogs,
      student.cgpa,
      student.cgpa,
      input.change_source || "manual",
      reason,
      manual_override,
      actor.id,
    ]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "STUDENT_ELIGIBILITY_CHANGED",
    target_type: "student",
    target_id: userId,
    student_id: userId,
    reason: `${input.eligible ? "Marked eligible" : "Marked not eligible"}: ${reason}`,
    metadata: {
      from: prevEligible,
      to: input.eligible,
      active_backlogs: nextBacklogs,
      cgpa: student.cgpa,
      manual_override,
      rule_eligible: rule_check.rule_eligible,
      eligibility_date: eligibilityDate,
    },
    ip_address: actor.ip,
  }).catch(() => {});

  return getEligibility(collegeId, userId);
}
