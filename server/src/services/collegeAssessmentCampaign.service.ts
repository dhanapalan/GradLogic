/**
 * Phase 2 Module 05 — Assessment Campaigns (events / drives over published assessments).
 * No attempt engine (Module 06).
 */
import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";
import { ensureCollegeAssessmentSchema } from "./collegeAssessment.service.js";

export const CAMPAIGN_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface CampaignInput {
  name: string;
  assessment_id: string;
  instructions?: string | null;
  start_at: string;
  end_at: string;
  max_attempts?: number;
  duration_minutes?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  allow_resume?: boolean;
  show_result_immediately?: boolean;
  negative_marking?: boolean;
  target_department?: string | null;
  target_batch?: string | null;
  target_semester?: string | null;
  target_section?: string | null;
  student_ids?: string[];
  notify_students?: boolean;
  reminder_enabled?: boolean;
  notify_email?: boolean;
  notify_in_app?: boolean;
  status?: string;
  force?: boolean;
  // Module 09 — Integrity settings
  proctoring_enabled?: boolean;
  require_fullscreen?: boolean;
  detect_tab_switch?: boolean;
  detect_window_blur?: boolean;
  detect_copy_paste?: boolean;
  detect_multi_monitor?: boolean;
  require_camera?: boolean;
  require_microphone?: boolean;
  tab_switch_limit?: number;
  integrity_auto_flag?: boolean;
}

export interface CampaignDashboard {
  assigned: number;
  started: number;
  completed: number;
  pending: number;
  expired: number;
}

export interface CampaignRow {
  id: string;
  college_id: string;
  campaign_code: string;
  name: string;
  assessment_id: string;
  assessment_code?: string;
  assessment_name?: string;
  assessment_status?: string;
  instructions: string | null;
  start_at: string;
  end_at: string;
  max_attempts: number;
  duration_minutes: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  show_result_immediately: boolean;
  negative_marking: boolean;
  target_department: string | null;
  target_batch: string | null;
  target_semester: string | null;
  target_section: string | null;
  notify_students: boolean;
  reminder_enabled: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  status: CampaignStatus;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  student_ids?: string[];
  dashboard?: CampaignDashboard;
  proctoring_enabled?: boolean;
  require_fullscreen?: boolean;
  detect_tab_switch?: boolean;
  detect_window_blur?: boolean;
  detect_copy_paste?: boolean;
  detect_multi_monitor?: boolean;
  require_camera?: boolean;
  require_microphone?: boolean;
  tab_switch_limit?: number;
  integrity_auto_flag?: boolean;
}

let schemaReady = false;

export async function ensureCampaignSchema(): Promise<void> {
  if (schemaReady) return;
  await ensureCollegeAssessmentSchema();
  await query(`
    CREATE TABLE IF NOT EXISTS college_assessment_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id),
      campaign_code VARCHAR(40) NOT NULL,
      name TEXT NOT NULL,
      assessment_id UUID NOT NULL REFERENCES college_assessments(id),
      instructions TEXT,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      max_attempts INT NOT NULL DEFAULT 1,
      duration_minutes INT,
      shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
      shuffle_options BOOLEAN NOT NULL DEFAULT FALSE,
      allow_resume BOOLEAN NOT NULL DEFAULT TRUE,
      show_result_immediately BOOLEAN NOT NULL DEFAULT FALSE,
      negative_marking BOOLEAN NOT NULL DEFAULT FALSE,
      target_department VARCHAR(200),
      target_batch VARCHAR(100),
      target_semester VARCHAR(50),
      target_section VARCHAR(50),
      notify_students BOOLEAN NOT NULL DEFAULT TRUE,
      reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      notify_email BOOLEAN NOT NULL DEFAULT TRUE,
      notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      attempts_used INT NOT NULL DEFAULT 0
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_student_picks (
      campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      PRIMARY KEY (campaign_id, user_id)
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_campaigns_code_unique
      ON college_assessment_campaigns (college_id, campaign_code)
  `).catch(() => {});
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_campaign_students_unique
      ON college_campaign_students (campaign_id, user_id)
  `).catch(() => {});
  // Module 09 columns (also ensured by collegeCampaignIntegrity.service)
  await query(`
    ALTER TABLE college_assessment_campaigns
      ADD COLUMN IF NOT EXISTS proctoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS require_fullscreen BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS detect_tab_switch BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS detect_window_blur BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS detect_copy_paste BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS detect_multi_monitor BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS require_camera BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS require_microphone BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS tab_switch_limit INT NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS integrity_auto_flag BOOLEAN NOT NULL DEFAULT TRUE
  `).catch(() => {});
  schemaReady = true;
}

function isStatus(v: string): v is CampaignStatus {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(v);
}

async function nextCode(collegeId: string) {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM college_assessment_campaigns WHERE college_id = $1`,
    [collegeId]
  );
  return `CC-${String((Number(row?.n) || 0) + 1).padStart(5, "0")}`;
}

async function assertPublishedAssessment(collegeId: string, assessmentId: string) {
  const row = await queryOne<{
    id: string;
    name: string;
    status: string;
    duration_minutes: number;
  }>(
    `SELECT id, name, status, duration_minutes
     FROM college_assessments
     WHERE id = $1 AND college_id = $2 AND deleted_at IS NULL`,
    [assessmentId, collegeId]
  );
  if (!row) throw new AppError("Assessment not found.", 404);
  if (row.status !== "published") {
    throw new AppError("Only Published assessments can be used in a campaign.", 400);
  }
  return row;
}

function validateHeader(body: CampaignInput) {
  const name = (body.name || "").trim();
  if (!name) throw new AppError("Campaign name is mandatory.", 400);
  if (!body.assessment_id) throw new AppError("Assessment is required.", 400);

  const start = new Date(body.start_at);
  const end = new Date(body.end_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Start and End date/time are required.", 400);
  }
  if (end <= start) throw new AppError("End must be after Start.", 400);

  const max_attempts = Math.max(1, Math.floor(Number(body.max_attempts ?? 1)));
  let status: CampaignStatus = "draft";
  if (body.status != null && String(body.status).trim()) {
    const s = String(body.status).trim().toLowerCase();
    if (!isStatus(s)) {
      throw new AppError("Invalid status. Allowed: Draft, Published, Closed, Archived.", 400);
    }
    status = s;
  }

  return {
    name,
    assessment_id: body.assessment_id,
    instructions: body.instructions?.trim() || null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    max_attempts,
    duration_minutes:
      body.duration_minutes != null && body.duration_minutes !== undefined
        ? Math.max(1, Math.floor(Number(body.duration_minutes)))
        : null,
    shuffle_questions: !!body.shuffle_questions,
    shuffle_options: !!body.shuffle_options,
    allow_resume: body.allow_resume !== false,
    show_result_immediately: !!body.show_result_immediately,
    negative_marking: !!body.negative_marking,
    target_department: emptyToNull(body.target_department),
    target_batch: emptyToNull(body.target_batch),
    target_semester: emptyToNull(body.target_semester),
    target_section: emptyToNull(body.target_section),
    student_ids: Array.isArray(body.student_ids)
      ? [...new Set(body.student_ids.filter(Boolean))]
      : [],
    notify_students: body.notify_students !== false,
    reminder_enabled: !!body.reminder_enabled,
    notify_email: body.notify_email !== false,
    notify_in_app: body.notify_in_app !== false,
    status,
  };
}

function emptyToNull(v?: string | null) {
  const s = (v || "").trim();
  return s || null;
}

/** Resolve audience from filters + explicit picks. */
export async function resolveAudience(
  collegeId: string,
  filters: {
    target_department: string | null;
    target_batch: string | null;
    target_semester: string | null;
    target_section: string | null;
    student_ids: string[];
  }
): Promise<string[]> {
  const ids = new Set<string>();

  if (filters.student_ids.length) {
    const rows = await query<{ user_id: string }>(
      `SELECT u.id AS user_id
       FROM users u
       JOIN student_details sd ON sd.user_id = u.id
       WHERE COALESCE(u.college_id, sd.college_id) = $1
         AND u.id = ANY($2::uuid[])
         AND LOWER(u.role::text) = 'student'
         AND u.deleted_at IS NULL
         AND u.is_active = TRUE`,
      [collegeId, filters.student_ids]
    );
    for (const r of rows) ids.add(r.user_id);
  }

  const hasFilter =
    filters.target_department ||
    filters.target_batch ||
    filters.target_semester ||
    filters.target_section;

  if (hasFilter || !filters.student_ids.length) {
    const params: unknown[] = [collegeId];
    let i = 2;
    let sql = `
      SELECT u.id AS user_id
      FROM users u
      JOIN student_details sd ON sd.user_id = u.id
      WHERE COALESCE(u.college_id, sd.college_id) = $1
        AND LOWER(u.role::text) = 'student'
        AND u.deleted_at IS NULL
        AND u.is_active = TRUE`;

    if (filters.target_department) {
      sql += ` AND sd.specialization ILIKE $${i++}`;
      params.push(filters.target_department);
    }
    if (filters.target_batch) {
      sql += ` AND (
        sd.class_name ILIKE $${i} OR sd.passing_year::text = $${i}
      )`;
      params.push(filters.target_batch);
      i++;
    }
    if (filters.target_semester) {
      sql += ` AND sd.semester ILIKE $${i++}`;
      params.push(filters.target_semester);
    }
    if (filters.target_section) {
      sql += ` AND sd.section ILIKE $${i++}`;
      params.push(filters.target_section);
    }

    // If only explicit students and no filters, skip broad query
    if (hasFilter || !filters.student_ids.length) {
      const rows = await query<{ user_id: string }>(sql, params);
      for (const r of rows) ids.add(r.user_id);
    }
  }

  return [...ids];
}

async function replacePicks(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  campaignId: string,
  studentIds: string[]
) {
  await client.query(`DELETE FROM college_campaign_student_picks WHERE campaign_id = $1`, [
    campaignId,
  ]);
  for (const uid of studentIds) {
    await client.query(
      `INSERT INTO college_campaign_student_picks (campaign_id, user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [campaignId, uid]
    );
  }
}

async function syncAssignedStudents(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  campaignId: string,
  collegeId: string,
  header: ReturnType<typeof validateHeader>
) {
  const audience = await resolveAudience(collegeId, header);
  await client.query(`DELETE FROM college_campaign_students WHERE campaign_id = $1`, [
    campaignId,
  ]);
  for (const uid of audience) {
    await client.query(
      `INSERT INTO college_campaign_students (campaign_id, user_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [campaignId, uid]
    );
  }
  return audience.length;
}

async function loadDashboard(campaignId: string, endAt: string): Promise<CampaignDashboard> {
  const row = await queryOne<{
    assigned: string;
    started: string;
    completed: string;
  }>(
    `SELECT
       COUNT(*)::text AS assigned,
       COUNT(*) FILTER (WHERE started_at IS NOT NULL)::text AS started,
       COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::text AS completed
     FROM college_campaign_students
     WHERE campaign_id = $1`,
    [campaignId]
  );
  const assigned = Number(row?.assigned || 0);
  const started = Number(row?.started || 0);
  const completed = Number(row?.completed || 0);
  const pending = Math.max(0, assigned - completed);
  const expired =
    new Date(endAt) < new Date()
      ? Math.max(0, assigned - completed)
      : 0;
  return { assigned, started, completed, pending, expired };
}

const SELECT_CAMPAIGN = `
  SELECT c.id, c.college_id, c.campaign_code, c.name, c.assessment_id,
         a.assessment_code, a.name AS assessment_name, a.status AS assessment_status,
         c.instructions, c.start_at::text, c.end_at::text, c.max_attempts,
         c.duration_minutes, c.shuffle_questions, c.shuffle_options, c.allow_resume,
         c.show_result_immediately, c.negative_marking,
         c.target_department, c.target_batch, c.target_semester, c.target_section,
         c.notify_students, c.reminder_enabled, c.notify_email, c.notify_in_app,
         COALESCE(c.proctoring_enabled, FALSE) AS proctoring_enabled,
         COALESCE(c.require_fullscreen, FALSE) AS require_fullscreen,
         COALESCE(c.detect_tab_switch, TRUE) AS detect_tab_switch,
         COALESCE(c.detect_window_blur, TRUE) AS detect_window_blur,
         COALESCE(c.detect_copy_paste, TRUE) AS detect_copy_paste,
         COALESCE(c.detect_multi_monitor, TRUE) AS detect_multi_monitor,
         COALESCE(c.require_camera, FALSE) AS require_camera,
         COALESCE(c.require_microphone, FALSE) AS require_microphone,
         COALESCE(c.tab_switch_limit, 5) AS tab_switch_limit,
         COALESCE(c.integrity_auto_flag, TRUE) AS integrity_auto_flag,
         c.status, c.created_by, c.updated_by, cu.name AS created_by_name,
         c.created_at::text, c.updated_at::text, c.is_active
  FROM college_assessment_campaigns c
  JOIN college_assessments a ON a.id = c.assessment_id
  LEFT JOIN users cu ON cu.id = c.created_by
`;

export async function listCampaigns(
  collegeId: string,
  filters: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
) {
  await ensureCampaignSchema();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * limit;
  const params: unknown[] = [collegeId];
  let i = 2;
  let where = `WHERE c.college_id = $1 AND c.deleted_at IS NULL`;

  if (filters.search?.trim()) {
    where += ` AND (c.name ILIKE $${i} OR c.campaign_code ILIKE $${i} OR a.name ILIKE $${i})`;
    params.push(`%${filters.search.trim()}%`);
    i++;
  }
  if (filters.status && isStatus(filters.status.trim().toLowerCase())) {
    where += ` AND c.status = $${i++}`;
    params.push(filters.status.trim().toLowerCase());
  }

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM college_assessment_campaigns c
     JOIN college_assessments a ON a.id = c.assessment_id
     ${where}`,
    params
  );
  const total = Number(countRow?.total || 0);

  const rows = await query<CampaignRow>(
    `${SELECT_CAMPAIGN}
     ${where}
     ORDER BY c.updated_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  for (const r of rows) {
    r.dashboard = await loadDashboard(r.id, r.end_at);
  }

  return {
    data: rows,
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getCampaign(collegeId: string, id: string) {
  await ensureCampaignSchema();
  const row = await queryOne<CampaignRow>(
    `${SELECT_CAMPAIGN}
     WHERE c.id = $1 AND c.college_id = $2 AND c.deleted_at IS NULL`,
    [id, collegeId]
  );
  if (!row) throw new AppError("Campaign not found.", 404);

  const picks = await query<{ user_id: string }>(
    `SELECT user_id FROM college_campaign_student_picks WHERE campaign_id = $1`,
    [id]
  );
  row.student_ids = picks.map((p) => p.user_id);
  row.dashboard = await loadDashboard(id, row.end_at);
  return row;
}

export async function createCampaign(
  collegeId: string,
  body: CampaignInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCampaignSchema();
  const header = validateHeader(body);
  const assessment = await assertPublishedAssessment(collegeId, header.assessment_id);
  if (header.duration_minutes == null) {
    header.duration_minutes = assessment.duration_minutes;
  }

  const id = uuidv4();
  const code = await nextCode(collegeId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO college_assessment_campaigns
         (id, college_id, campaign_code, name, assessment_id, instructions,
          start_at, end_at, max_attempts, duration_minutes,
          shuffle_questions, shuffle_options, allow_resume, show_result_immediately, negative_marking,
          target_department, target_batch, target_semester, target_section,
          notify_students, reminder_enabled, notify_email, notify_in_app,
          status, created_by, updated_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$25,TRUE)`,
      [
        id,
        collegeId,
        code,
        header.name,
        header.assessment_id,
        header.instructions,
        header.start_at,
        header.end_at,
        header.max_attempts,
        header.duration_minutes,
        header.shuffle_questions,
        header.shuffle_options,
        header.allow_resume,
        header.show_result_immediately,
        header.negative_marking,
        header.target_department,
        header.target_batch,
        header.target_semester,
        header.target_section,
        header.notify_students,
        header.reminder_enabled,
        header.notify_email,
        header.notify_in_app,
        header.status === "published" ? "draft" : header.status, // publish via dedicated endpoint
        actor.id,
      ]
    );
    await replacePicks(client, id, header.student_ids);
    if (header.status === "published") {
      // force draft insert then publish path below
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_CREATED",
    target_type: "campaign",
    target_id: id,
    reason: `Assessment campaign created (${code})`,
    metadata: { college_id: collegeId, assessment_id: header.assessment_id },
    ip_address: actor.ip,
  }).catch(() => {});

  // Module 09 — persist integrity settings after header insert
  try {
    const { persistCampaignIntegritySettings } = await import(
      "./collegeCampaignIntegrity.service.js"
    );
    await persistCampaignIntegritySettings(collegeId, id, body);
  } catch {
    /* columns may not exist yet on very old DBs; ensureSchema runs on first integrity call */
  }

  if (body.status === "published") {
    return publishCampaign(collegeId, id, actor);
  }
  return getCampaign(collegeId, id);
}

export async function updateCampaign(
  collegeId: string,
  id: string,
  body: CampaignInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCampaignSchema();
  const existing = await getCampaign(collegeId, id);
  if (existing.status === "closed" || existing.status === "archived") {
    throw new AppError("Closed or archived campaigns cannot be edited.", 400);
  }
  if (existing.status === "published") {
    // allow limited updates? Spec says Create/Edit — allow schedule/settings while published
  }

  const header = validateHeader({ ...body, status: existing.status });
  await assertPublishedAssessment(collegeId, header.assessment_id);

  await query(
    `UPDATE college_assessment_campaigns
     SET name = $1, assessment_id = $2, instructions = $3,
         start_at = $4, end_at = $5, max_attempts = $6, duration_minutes = $7,
         shuffle_questions = $8, shuffle_options = $9, allow_resume = $10,
         show_result_immediately = $11, negative_marking = $12,
         target_department = $13, target_batch = $14, target_semester = $15, target_section = $16,
         notify_students = $17, reminder_enabled = $18, notify_email = $19, notify_in_app = $20,
         updated_by = $21, updated_at = NOW()
     WHERE id = $22 AND college_id = $23 AND deleted_at IS NULL`,
    [
      header.name,
      header.assessment_id,
      header.instructions,
      header.start_at,
      header.end_at,
      header.max_attempts,
      header.duration_minutes,
      header.shuffle_questions,
      header.shuffle_options,
      header.allow_resume,
      header.show_result_immediately,
      header.negative_marking,
      header.target_department,
      header.target_batch,
      header.target_semester,
      header.target_section,
      header.notify_students,
      header.reminder_enabled,
      header.notify_email,
      header.notify_in_app,
      actor.id,
      id,
      collegeId,
    ]
  );

  try {
    const { persistCampaignIntegritySettings } = await import(
      "./collegeCampaignIntegrity.service.js"
    );
    await persistCampaignIntegritySettings(collegeId, id, body);
  } catch {
    /* ignore if integrity schema not ready */
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await replacePicks(client, id, header.student_ids);
    if (existing.status === "published") {
      await syncAssignedStudents(client, id, collegeId, header);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_UPDATED",
    target_type: "campaign",
    target_id: id,
    reason: `Assessment campaign updated (${existing.campaign_code})`,
    ip_address: actor.ip,
  }).catch(() => {});

  return getCampaign(collegeId, id);
}

export async function publishCampaign(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getCampaign(collegeId, id);
  await assertPublishedAssessment(collegeId, existing.assessment_id);

  const header = validateHeader({
    name: existing.name,
    assessment_id: existing.assessment_id,
    instructions: existing.instructions,
    start_at: existing.start_at,
    end_at: existing.end_at,
    max_attempts: existing.max_attempts,
    duration_minutes: existing.duration_minutes,
    shuffle_questions: existing.shuffle_questions,
    shuffle_options: existing.shuffle_options,
    allow_resume: existing.allow_resume,
    show_result_immediately: existing.show_result_immediately,
    negative_marking: existing.negative_marking,
    target_department: existing.target_department,
    target_batch: existing.target_batch,
    target_semester: existing.target_semester,
    target_section: existing.target_section,
    student_ids: existing.student_ids || [],
    notify_students: existing.notify_students,
    reminder_enabled: existing.reminder_enabled,
    notify_email: existing.notify_email,
    notify_in_app: existing.notify_in_app,
  });

  const client = await pool.connect();
  let assigned = 0;
  try {
    await client.query("BEGIN");
    assigned = await syncAssignedStudents(client, id, collegeId, header);
    if (assigned < 1) {
      throw new AppError(
        "Cannot publish campaign with zero students. Adjust department/batch/section filters or pick students.",
        400
      );
    }
    await client.query(
      `UPDATE college_assessment_campaigns
       SET status = 'published', is_active = TRUE, updated_by = $1, updated_at = NOW()
       WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
      [actor.id, id, collegeId]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // Notification stub — Module 05 records intent; delivery can hook later
  if (existing.notify_students) {
    await writeAuditLog({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "ASSESSMENT_PUBLISHED",
      target_type: "campaign",
      target_id: id,
      reason: `Campaign published — ${assigned} students assigned` +
        (existing.notify_email || existing.notify_in_app ? " (notifications queued)" : ""),
      metadata: {
        assigned,
        notify_email: existing.notify_email,
        notify_in_app: existing.notify_in_app,
        reminder: existing.reminder_enabled,
      },
      ip_address: actor.ip,
    }).catch(() => {});
  } else {
    await writeAuditLog({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "ASSESSMENT_PUBLISHED",
      target_type: "campaign",
      target_id: id,
      reason: `Campaign published — ${assigned} students assigned`,
      metadata: { assigned },
      ip_address: actor.ip,
    }).catch(() => {});
  }

  return getCampaign(collegeId, id);
}

export async function closeCampaign(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getCampaign(collegeId, id);
  if (existing.status !== "published") {
    throw new AppError("Only published campaigns can be closed.", 400);
  }
  await query(
    `UPDATE college_assessment_campaigns
     SET status = 'closed', updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );
  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_UPDATED",
    target_type: "campaign",
    target_id: id,
    reason: `Campaign closed (${existing.campaign_code})`,
    ip_address: actor.ip,
  }).catch(() => {});
  return getCampaign(collegeId, id);
}

export async function archiveCampaign(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getCampaign(collegeId, id);
  await query(
    `UPDATE college_assessment_campaigns
     SET status = 'archived', is_active = FALSE, updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );
  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_ARCHIVED",
    target_type: "campaign",
    target_id: id,
    reason: `Campaign archived (${existing.campaign_code})`,
    ip_address: actor.ip,
  }).catch(() => {});
  return getCampaign(collegeId, id);
}

export async function softDeleteCampaign(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getCampaign(collegeId, id);
  if (existing.status === "published") {
    throw new AppError("Published campaigns cannot be deleted. Close or archive first.", 400);
  }
  await query(
    `UPDATE college_assessment_campaigns
     SET deleted_at = NOW(), is_active = FALSE, status = 'archived',
         updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );
  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_DELETED",
    target_type: "campaign",
    target_id: id,
    reason: `Campaign soft-deleted (${existing.campaign_code})`,
    ip_address: actor.ip,
  }).catch(() => {});
  return { success: true, id };
}

export async function previewAudience(collegeId: string, body: CampaignInput) {
  await ensureCampaignSchema();
  const header = validateHeader(body);
  const ids = await resolveAudience(collegeId, header);
  return { count: ids.length, sample_ids: ids.slice(0, 20) };
}

export function metaCatalog() {
  return {
    statuses: CAMPAIGN_STATUSES.map((s) => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    })),
  };
}
