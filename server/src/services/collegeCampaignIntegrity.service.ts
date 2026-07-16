/**
 * Phase 2 Module 09 — Assessment Integrity (AI Proctoring) for college campaigns.
 * Separate from attempt workspace (answers/timer) and evaluation (scoring).
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureAttemptSchema } from "./studentCampaignAttempt.service.js";
import { writeAuditLog } from "./audit.service.js";

export type IntegrityRiskLevel = "low" | "medium" | "high";
export type IntegrityIncidentStatus = "open" | "reviewed" | "dismissed";

export interface CampaignIntegritySettings {
  proctoring_enabled: boolean;
  require_fullscreen: boolean;
  detect_tab_switch: boolean;
  detect_window_blur: boolean;
  detect_copy_paste: boolean;
  detect_multi_monitor: boolean;
  require_camera: boolean;
  require_microphone: boolean;
  tab_switch_limit: number;
  integrity_auto_flag: boolean;
}

const EVENT_WEIGHTS: Record<string, number> = {
  TAB_SWITCH: 2,
  WINDOW_BLUR: 2,
  FULLSCREEN_EXIT: 2,
  FULLSCREEN_ENTER: 0,
  COPY_ATTEMPT: 3,
  PASTE_ATTEMPT: 3,
  RIGHT_CLICK: 1,
  MULTI_MONITOR: 5,
  NETWORK_DISCONNECT: 1,
  NETWORK_RECONNECT: 0,
  CAMERA_DENIED: 8,
  CAMERA_OFF: 4,
  CAMERA_OK: 0,
  MICROPHONE_DENIED: 6,
  MICROPHONE_OFF: 3,
  MICROPHONE_OK: 0,
  FACE_NOT_DETECTED: 4,
  MULTIPLE_FACES: 8,
  DEVTOOLS_OPEN: 5,
  TAB_SWITCH_LIMIT: 10,
};

const CRITICAL_EVENTS = new Set([
  "CAMERA_DENIED",
  "MULTIPLE_FACES",
  "TAB_SWITCH_LIMIT",
  "MULTI_MONITOR",
]);

let schemaReady = false;

export async function ensureIntegritySchema(): Promise<void> {
  if (schemaReady) return;
  await ensureAttemptSchema();

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

  await query(`
    ALTER TABLE college_campaign_attempts
      ADD COLUMN IF NOT EXISTS integrity_score INT NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS integrity_violations INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) NOT NULL DEFAULT 'clear'
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_integrity_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID NOT NULL REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
      campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      event_type VARCHAR(60) NOT NULL,
      risk_delta INT NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_integrity_incidents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID NOT NULL UNIQUE REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
      campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      integrity_score INT NOT NULL DEFAULT 100,
      event_count INT NOT NULL DEFAULT 0,
      risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      notes TEXT,
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_campaign_integrity_events_attempt
      ON college_campaign_integrity_events (attempt_id, created_at DESC)
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_campaign_integrity_events_campaign
      ON college_campaign_integrity_events (campaign_id, created_at DESC)
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_campaign_integrity_incidents_campaign
      ON college_campaign_integrity_incidents (campaign_id, status, risk_level)
  `).catch(() => {});

  schemaReady = true;
}

function defaultSettings(): CampaignIntegritySettings {
  return {
    proctoring_enabled: false,
    require_fullscreen: false,
    detect_tab_switch: true,
    detect_window_blur: true,
    detect_copy_paste: true,
    detect_multi_monitor: true,
    require_camera: false,
    require_microphone: false,
    tab_switch_limit: 5,
    integrity_auto_flag: true,
  };
}

function mapSettings(row: Record<string, unknown> | null): CampaignIntegritySettings {
  if (!row) return defaultSettings();
  return {
    proctoring_enabled: !!row.proctoring_enabled,
    require_fullscreen: !!row.require_fullscreen,
    detect_tab_switch: row.detect_tab_switch !== false,
    detect_window_blur: row.detect_window_blur !== false,
    detect_copy_paste: row.detect_copy_paste !== false,
    detect_multi_monitor: row.detect_multi_monitor !== false,
    require_camera: !!row.require_camera,
    require_microphone: !!row.require_microphone,
    tab_switch_limit: Math.max(1, Number(row.tab_switch_limit) || 5),
    integrity_auto_flag: row.integrity_auto_flag !== false,
  };
}

export async function getCampaignSettings(
  collegeId: string,
  campaignId: string
): Promise<CampaignIntegritySettings & { campaign_id: string; campaign_name: string }> {
  await ensureIntegritySchema();
  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, name, proctoring_enabled, require_fullscreen, detect_tab_switch,
            detect_window_blur, detect_copy_paste, detect_multi_monitor,
            require_camera, require_microphone, tab_switch_limit, integrity_auto_flag
     FROM college_assessment_campaigns
     WHERE id = $1 AND college_id = $2 AND deleted_at IS NULL`,
    [campaignId, collegeId]
  );
  if (!row) throw new AppError("Campaign not found.", 404);
  return {
    campaign_id: String(row.id),
    campaign_name: String(row.name),
    ...mapSettings(row),
  };
}

/** Settings + live integrity snapshot for the student attempt workspace. */
export async function getStudentIntegrityContext(studentId: string, campaignId: string) {
  await ensureIntegritySchema();
  const campaign = await queryOne<Record<string, unknown>>(
    `SELECT c.id, c.name, c.proctoring_enabled, c.require_fullscreen, c.detect_tab_switch,
            c.detect_window_blur, c.detect_copy_paste, c.detect_multi_monitor,
            c.require_camera, c.require_microphone, c.tab_switch_limit, c.integrity_auto_flag
     FROM college_assessment_campaigns c
     JOIN college_campaign_students cs ON cs.campaign_id = c.id AND cs.user_id = $2
     WHERE c.id = $1 AND c.deleted_at IS NULL AND c.status = 'published'`,
    [campaignId, studentId]
  );
  if (!campaign) throw new AppError("Campaign not found or not assigned.", 404);

  const attempt = await queryOne<{
    id: string;
    status: string;
    integrity_score: number;
    integrity_violations: number;
    integrity_status: string;
  }>(
    `SELECT id, status, integrity_score, integrity_violations, integrity_status
     FROM college_campaign_attempts
     WHERE campaign_id = $1 AND user_id = $2 AND status = 'in_progress'
     ORDER BY attempt_number DESC LIMIT 1`,
    [campaignId, studentId]
  );

  return {
    settings: mapSettings(campaign),
    campaign_id: String(campaign.id),
    campaign_name: String(campaign.name),
    attempt: attempt
      ? {
          id: attempt.id,
          status: attempt.status,
          integrity_score: attempt.integrity_score,
          integrity_violations: attempt.integrity_violations,
          integrity_status: attempt.integrity_status,
        }
      : null,
  };
}

function eventAllowed(settings: CampaignIntegritySettings, eventType: string): boolean {
  if (!settings.proctoring_enabled) return false;
  if (eventType === "TAB_SWITCH" || eventType === "TAB_SWITCH_LIMIT") {
    return settings.detect_tab_switch;
  }
  if (eventType === "WINDOW_BLUR") return settings.detect_window_blur;
  if (eventType === "COPY_ATTEMPT" || eventType === "PASTE_ATTEMPT" || eventType === "RIGHT_CLICK") {
    return settings.detect_copy_paste;
  }
  if (eventType === "MULTI_MONITOR") return settings.detect_multi_monitor;
  if (eventType.startsWith("CAMERA_") || eventType === "FACE_NOT_DETECTED" || eventType === "MULTIPLE_FACES") {
    return settings.require_camera;
  }
  if (eventType.startsWith("MICROPHONE_")) return settings.require_microphone;
  if (eventType.startsWith("FULLSCREEN_")) return settings.require_fullscreen || settings.proctoring_enabled;
  if (eventType.startsWith("NETWORK_") || eventType === "DEVTOOLS_OPEN") return true;
  return true;
}

async function recomputeAttemptIntegrity(attemptId: string) {
  const events = await query<{ event_type: string; risk_delta: number }>(
    `SELECT event_type, risk_delta FROM college_campaign_integrity_events WHERE attempt_id = $1`,
    [attemptId]
  );

  let penalty = 0;
  let critical = false;
  for (const e of events) {
    penalty += Number(e.risk_delta) || 0;
    if (CRITICAL_EVENTS.has(e.event_type)) critical = true;
  }
  const score = Math.max(0, 100 - penalty);
  let risk: IntegrityRiskLevel = "low";
  if (score < 50 || critical) risk = "high";
  else if (score < 80) risk = "medium";

  const integrity_status =
    risk === "high" ? "critical" : risk === "medium" ? "flagged" : "clear";

  await query(
    `UPDATE college_campaign_attempts
     SET integrity_score = $1, integrity_violations = $2, integrity_status = $3
     WHERE id = $4`,
    [score, events.length, integrity_status, attemptId]
  );

  const attempt = await queryOne<{
    campaign_id: string;
    user_id: string;
  }>(`SELECT campaign_id, user_id FROM college_campaign_attempts WHERE id = $1`, [attemptId]);
  if (!attempt) return { score, risk, event_count: events.length };

  const campaign = await queryOne<{ integrity_auto_flag: boolean }>(
    `SELECT integrity_auto_flag FROM college_assessment_campaigns WHERE id = $1`,
    [attempt.campaign_id]
  );

  if (campaign?.integrity_auto_flag !== false && (risk === "medium" || risk === "high")) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM college_campaign_integrity_incidents WHERE attempt_id = $1`,
      [attemptId]
    );
    if (existing) {
      await query(
        `UPDATE college_campaign_integrity_incidents
         SET integrity_score = $1, event_count = $2, risk_level = $3, updated_at = NOW()
         WHERE id = $4 AND status = 'open'`,
        [score, events.length, risk, existing.id]
      );
    } else {
      await query(
        `INSERT INTO college_campaign_integrity_incidents
           (attempt_id, campaign_id, user_id, integrity_score, event_count, risk_level, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
        [attemptId, attempt.campaign_id, attempt.user_id, score, events.length, risk]
      );
    }
  }

  return { score, risk, event_count: events.length, integrity_status };
}

export async function logStudentEvent(
  studentId: string,
  campaignId: string,
  eventTypeRaw: string,
  metadata?: Record<string, unknown>
) {
  await ensureIntegritySchema();
  const eventType = String(eventTypeRaw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  if (!eventType || eventType.length > 60) {
    throw new AppError("Invalid event type.", 400);
  }

  const ctx = await getStudentIntegrityContext(studentId, campaignId);
  if (!ctx.settings.proctoring_enabled) {
    return { logged: false, reason: "proctoring_disabled" };
  }
  if (!ctx.attempt) {
    throw new AppError("No active attempt to attach integrity events.", 400);
  }
  if (!eventAllowed(ctx.settings, eventType)) {
    return { logged: false, reason: "event_disabled" };
  }

  let meta: Record<string, unknown> = {
    ...(metadata || {}),
    client_ts: new Date().toISOString(),
  };
  let hitTabLimit = false;

  if (eventType === "TAB_SWITCH" && metadata?.state === "hidden") {
    const switches = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM college_campaign_integrity_events
       WHERE attempt_id = $1 AND event_type = 'TAB_SWITCH'
         AND (metadata->>'state') = 'hidden'`,
      [ctx.attempt.id]
    );
    const count = Number(switches?.n || 0) + 1;
    meta = { ...meta, tab_switch_count: count, limit: ctx.settings.tab_switch_limit };
    hitTabLimit = count >= ctx.settings.tab_switch_limit;
  }

  const risk_delta = EVENT_WEIGHTS[eventType] ?? 1;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO college_campaign_integrity_events
       (attempt_id, campaign_id, user_id, event_type, risk_delta, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [ctx.attempt.id, campaignId, studentId, eventType, risk_delta, JSON.stringify(meta)]
  );

  if (hitTabLimit) {
    const already = await queryOne<{ id: string }>(
      `SELECT id FROM college_campaign_integrity_events
       WHERE attempt_id = $1 AND event_type = 'TAB_SWITCH_LIMIT' LIMIT 1`,
      [ctx.attempt.id]
    );
    if (!already) {
      await query(
        `INSERT INTO college_campaign_integrity_events
           (attempt_id, campaign_id, user_id, event_type, risk_delta, metadata)
         VALUES ($1, $2, $3, 'TAB_SWITCH_LIMIT', $4, $5::jsonb)`,
        [
          ctx.attempt.id,
          campaignId,
          studentId,
          EVENT_WEIGHTS.TAB_SWITCH_LIMIT,
          JSON.stringify(meta),
        ]
      );
    }
  }

  const summary = await recomputeAttemptIntegrity(ctx.attempt.id);
  return {
    logged: true,
    event_id: row?.id,
    event_type: eventType,
    tab_switch_limit_reached: hitTabLimit,
    ...summary,
  };
}

export async function getCampaignIntegrityDashboard(collegeId: string, campaignId: string) {
  await ensureIntegritySchema();
  const campaign = await queryOne<{
    id: string;
    name: string;
    campaign_code: string;
    proctoring_enabled: boolean;
  }>(
    `SELECT id, name, campaign_code, proctoring_enabled
     FROM college_assessment_campaigns
     WHERE id = $1 AND college_id = $2 AND deleted_at IS NULL`,
    [campaignId, collegeId]
  );
  if (!campaign) throw new AppError("Campaign not found.", 404);

  const summary = await queryOne<{
    in_progress: string;
    flagged: string;
    critical: string;
    open_incidents: string;
    total_events: string;
    avg_score: string | null;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE a.status = 'in_progress')::text AS in_progress,
       COUNT(*) FILTER (WHERE a.integrity_status = 'flagged')::text AS flagged,
       COUNT(*) FILTER (WHERE a.integrity_status = 'critical')::text AS critical,
       (SELECT COUNT(*)::text FROM college_campaign_integrity_incidents i
         WHERE i.campaign_id = $1 AND i.status = 'open') AS open_incidents,
       (SELECT COUNT(*)::text FROM college_campaign_integrity_events e
         WHERE e.campaign_id = $1) AS total_events,
       ROUND(AVG(a.integrity_score) FILTER (
         WHERE a.status IN ('in_progress', 'submitted', 'expired')
       ))::text AS avg_score
     FROM college_campaign_attempts a
     WHERE a.campaign_id = $1`,
    [campaignId]
  );

  const eventBreakdown = await query<{ event_type: string; count: string }>(
    `SELECT event_type, COUNT(*)::text AS count
     FROM college_campaign_integrity_events
     WHERE campaign_id = $1
     GROUP BY event_type
     ORDER BY COUNT(*) DESC
     LIMIT 20`,
    [campaignId]
  );

  const attempts = await query<{
    attempt_id: string;
    user_id: string;
    student_name: string;
    student_email: string;
    attempt_number: number;
    attempt_status: string;
    integrity_score: number;
    integrity_violations: number;
    integrity_status: string;
    started_at: string | null;
    submitted_at: string | null;
    incident_id: string | null;
    incident_status: string | null;
    risk_level: string | null;
  }>(
    `SELECT a.id AS attempt_id, a.user_id, u.name AS student_name, u.email AS student_email,
            a.attempt_number, a.status AS attempt_status,
            a.integrity_score, a.integrity_violations, a.integrity_status,
            a.started_at::text, a.submitted_at::text,
            i.id AS incident_id, i.status AS incident_status, i.risk_level
     FROM college_campaign_attempts a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN college_campaign_integrity_incidents i ON i.attempt_id = a.id
     WHERE a.campaign_id = $1
       AND a.status IN ('in_progress', 'submitted', 'expired')
     ORDER BY
       CASE a.integrity_status WHEN 'critical' THEN 0 WHEN 'flagged' THEN 1 ELSE 2 END,
       a.integrity_score ASC,
       a.started_at DESC NULLS LAST`,
    [campaignId]
  );

  const settings = await getCampaignSettings(collegeId, campaignId);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      campaign_code: campaign.campaign_code,
      proctoring_enabled: campaign.proctoring_enabled,
    },
    settings,
    summary: {
      in_progress: Number(summary?.in_progress || 0),
      flagged: Number(summary?.flagged || 0),
      critical: Number(summary?.critical || 0),
      open_incidents: Number(summary?.open_incidents || 0),
      total_events: Number(summary?.total_events || 0),
      avg_integrity_score: Number(summary?.avg_score || 100),
    },
    event_breakdown: eventBreakdown.map((e) => ({
      event_type: e.event_type,
      count: Number(e.count),
    })),
    attempts: attempts.map((a) => ({
      attempt_id: a.attempt_id,
      user_id: a.user_id,
      student_name: a.student_name,
      student_email: a.student_email,
      attempt_number: a.attempt_number,
      attempt_status: a.attempt_status,
      integrity_score: a.integrity_score,
      integrity_violations: a.integrity_violations,
      integrity_status: a.integrity_status,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      incident_id: a.incident_id,
      incident_status: a.incident_status,
      risk_level: a.risk_level,
    })),
  };
}

export async function getAttemptIntegrityTimeline(
  collegeId: string,
  campaignId: string,
  attemptId: string
) {
  await ensureIntegritySchema();
  const attempt = await queryOne<{
    id: string;
    user_id: string;
    student_name: string;
    student_email: string;
    attempt_number: number;
    status: string;
    integrity_score: number;
    integrity_violations: number;
    integrity_status: string;
  }>(
    `SELECT a.id, a.user_id, u.name AS student_name, u.email AS student_email,
            a.attempt_number, a.status, a.integrity_score, a.integrity_violations, a.integrity_status
     FROM college_campaign_attempts a
     JOIN college_assessment_campaigns c ON c.id = a.campaign_id
     JOIN users u ON u.id = a.user_id
     WHERE a.id = $1 AND a.campaign_id = $2 AND c.college_id = $3`,
    [attemptId, campaignId, collegeId]
  );
  if (!attempt) throw new AppError("Attempt not found.", 404);

  const events = await query<{
    id: string;
    event_type: string;
    risk_delta: number;
    metadata: unknown;
    created_at: string;
  }>(
    `SELECT id, event_type, risk_delta, metadata, created_at::text
     FROM college_campaign_integrity_events
     WHERE attempt_id = $1
     ORDER BY created_at ASC`,
    [attemptId]
  );

  const incident = await queryOne<{
    id: string;
    risk_level: string;
    status: string;
    notes: string | null;
    reviewed_at: string | null;
  }>(
    `SELECT id, risk_level, status, notes, reviewed_at::text
     FROM college_campaign_integrity_incidents WHERE attempt_id = $1`,
    [attemptId]
  );

  return {
    attempt: {
      id: attempt.id,
      user_id: attempt.user_id,
      student_name: attempt.student_name,
      student_email: attempt.student_email,
      attempt_number: attempt.attempt_number,
      status: attempt.status,
      integrity_score: attempt.integrity_score,
      integrity_violations: attempt.integrity_violations,
      integrity_status: attempt.integrity_status,
    },
    incident,
    events: events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      risk_delta: e.risk_delta,
      metadata: e.metadata,
      created_at: e.created_at,
    })),
  };
}

export async function reviewIncident(
  collegeId: string,
  campaignId: string,
  incidentId: string,
  body: { status: IntegrityIncidentStatus; notes?: string | null },
  actor: { id: string; role: string; ip?: string }
) {
  await ensureIntegritySchema();
  if (!["reviewed", "dismissed", "open"].includes(body.status)) {
    throw new AppError("Invalid incident status.", 400);
  }

  const row = await queryOne<{ id: string }>(
    `SELECT i.id
     FROM college_campaign_integrity_incidents i
     JOIN college_assessment_campaigns c ON c.id = i.campaign_id
     WHERE i.id = $1 AND i.campaign_id = $2 AND c.college_id = $3`,
    [incidentId, campaignId, collegeId]
  );
  if (!row) throw new AppError("Incident not found.", 404);

  await query(
    `UPDATE college_campaign_integrity_incidents
     SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [body.status, body.notes?.trim() || null, actor.id, incidentId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "CAMPAIGN_INTEGRITY_REVIEW",
    target_type: "college_campaign_integrity_incident",
    target_id: incidentId,
    reason: `Integrity incident ${body.status}`,
    metadata: { campaign_id: campaignId, status: body.status },
    ip_address: actor.ip,
  }).catch(() => {});

  return getCampaignIntegrityDashboard(collegeId, campaignId);
}

/** Normalize integrity fields from campaign create/update payloads. */
export function normalizeIntegrityInput(body: Partial<CampaignIntegritySettings>) {
  return {
    proctoring_enabled: !!body.proctoring_enabled,
    require_fullscreen: !!body.require_fullscreen,
    detect_tab_switch: body.detect_tab_switch !== false,
    detect_window_blur: body.detect_window_blur !== false,
    detect_copy_paste: body.detect_copy_paste !== false,
    detect_multi_monitor: body.detect_multi_monitor !== false,
    require_camera: !!body.require_camera,
    require_microphone: !!body.require_microphone,
    tab_switch_limit: Math.max(1, Math.floor(Number(body.tab_switch_limit ?? 5))),
    integrity_auto_flag: body.integrity_auto_flag !== false,
  };
}

/** Persist Module 09 settings on a campaign (called from campaign create/update). */
export async function persistCampaignIntegritySettings(
  collegeId: string,
  campaignId: string,
  body: Partial<CampaignIntegritySettings>
) {
  await ensureIntegritySchema();
  const s = normalizeIntegrityInput(body);
  const row = await queryOne<{ id: string }>(
    `UPDATE college_assessment_campaigns
     SET proctoring_enabled = $1, require_fullscreen = $2, detect_tab_switch = $3,
         detect_window_blur = $4, detect_copy_paste = $5, detect_multi_monitor = $6,
         require_camera = $7, require_microphone = $8, tab_switch_limit = $9,
         integrity_auto_flag = $10, updated_at = NOW()
     WHERE id = $11 AND college_id = $12 AND deleted_at IS NULL
     RETURNING id`,
    [
      s.proctoring_enabled,
      s.require_fullscreen,
      s.detect_tab_switch,
      s.detect_window_blur,
      s.detect_copy_paste,
      s.detect_multi_monitor,
      s.require_camera,
      s.require_microphone,
      s.tab_switch_limit,
      s.integrity_auto_flag,
      campaignId,
      collegeId,
    ]
  );
  if (!row) throw new AppError("Campaign not found.", 404);
  return s;
}
