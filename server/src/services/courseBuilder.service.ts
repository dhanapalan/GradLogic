// =============================================================================
// Course Builder — dashboard aggregates + module asset assembly helpers.
// Assembles Knowledge Library refs; does not author learning content.
// =============================================================================

import { query, queryOne } from "../config/database.js";

export interface CourseBuilderDashboard {
  total: number;
  draft: number;
  published: number;
  archived: number;
  studentsEnrolled: number;
  completionPercent: number | null;
  averageRating: number | null;
  byDomain: { domain: string; count: number }[];
}

const PHASE1_DOMAINS = [
  "aptitude",
  "reasoning",
  "python_coding",
  "java_coding",
  "data_science",
] as const;

export async function getDashboardSummary(): Promise<CourseBuilderDashboard> {
  const statusRows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
     FROM courses
     GROUP BY status`
  );

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of statusRows) {
    const n = Number(row.count) || 0;
    byStatus[row.status] = n;
    total += n;
  }

  const enrollRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM enrollments`
  );
  const studentsEnrolled = Number(enrollRow?.total) || 0;

  // Completion: share of enrollments with progress >= 100 when progress exists.
  let completionPercent: number | null = null;
  try {
    const prog = await queryOne<{ pct: string | null }>(`
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE COALESCE(e.progress_percent, 0) >= 100)
        / NULLIF(COUNT(*), 0)
      )::text AS pct
      FROM enrollments e
    `);
    if (prog?.pct != null) completionPercent = Number(prog.pct);
  } catch {
    // progress_percent may not exist on older schemas — leave null (UI shows unavailable)
    completionPercent = null;
  }

  const domainRows = await query<{ category: string; count: string }>(`
    SELECT category, COUNT(*)::text AS count
    FROM courses
    WHERE category = ANY($1::text[])
    GROUP BY category
    ORDER BY count DESC
  `, [PHASE1_DOMAINS as unknown as string[]]);

  return {
    total,
    draft: byStatus.draft || 0,
    published: byStatus.published || 0,
    archived: byStatus.archived || 0,
    studentsEnrolled,
    completionPercent,
    averageRating: null,
    byDomain: domainRows.map((r) => ({
      domain: r.category,
      count: Number(r.count) || 0,
    })),
  };
}

export type ModuleAssetType =
  | "question"
  | "coding_challenge"
  | "flashcard"
  | "content"
  | "lesson"
  | "voice_lesson";

export type ModuleAssetRole =
  | "lesson"
  | "practice"
  | "coding"
  | "assessment"
  | "resource"
  | "voice";

const ASSET_TITLE_SQL = `
  CASE a.asset_type
    WHEN 'question' THEN (SELECT LEFT(qb.question_text, 160) FROM question_bank qb WHERE qb.id = a.asset_id)
    WHEN 'coding_challenge' THEN (SELECT LEFT(qb.question_text, 160) FROM question_bank qb WHERE qb.id = a.asset_id)
    WHEN 'flashcard' THEN (SELECT LEFT(f.front, 160) FROM flashcards f WHERE f.id = a.asset_id)
    WHEN 'content' THEN (SELECT cli.title FROM content_library_items cli WHERE cli.id = a.asset_id)
    WHEN 'lesson' THEN (SELECT l.title FROM lessons l WHERE l.id = a.asset_id)
    WHEN 'voice_lesson' THEN (SELECT l.title FROM lessons l WHERE l.id = a.asset_id)
    ELSE NULL
  END
`;

export async function listModuleAssets(moduleId: string) {
  return query(
    `SELECT a.*, (${ASSET_TITLE_SQL}) AS asset_title
     FROM course_module_assets a
     WHERE a.module_id = $1
     ORDER BY a.sort_order ASC, a.created_at ASC`,
    [moduleId]
  );
}

export async function attachModuleAsset(input: {
  moduleId: string;
  assetType: ModuleAssetType;
  assetId: string;
  role: ModuleAssetRole;
  sortOrder?: number;
  meta?: Record<string, unknown>;
}) {
  return queryOne(
    `INSERT INTO course_module_assets
       (module_id, asset_type, asset_id, role, sort_order, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (module_id, asset_type, asset_id, role)
     DO UPDATE SET
       sort_order = EXCLUDED.sort_order,
       meta = EXCLUDED.meta,
       updated_at = NOW()
     RETURNING *`,
    [
      input.moduleId,
      input.assetType,
      input.assetId,
      input.role,
      input.sortOrder ?? 0,
      JSON.stringify(input.meta || {}),
    ]
  );
}

export async function detachModuleAsset(id: string) {
  await query(`DELETE FROM course_module_assets WHERE id = $1`, [id]);
}

export async function listCourseAssets(courseId: string) {
  return query(
    `SELECT a.*, m.title AS module_title, m.sort_order AS module_sort,
            (${ASSET_TITLE_SQL}) AS asset_title
     FROM course_module_assets a
     JOIN course_modules m ON m.id = a.module_id
     WHERE m.course_id = $1
     ORDER BY m.sort_order, a.sort_order, a.created_at`,
    [courseId]
  );
}

export interface AssessmentConfig {
  passing_percent: number;
  attempts: number;
  min_practice_per_module: number;
  require_assessment: boolean;
}

export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  passing_percent: 60,
  attempts: 3,
  min_practice_per_module: 3,
  require_assessment: true,
};

export function normalizeAssessmentConfig(raw: unknown): AssessmentConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const passing = Number(o.passing_percent ?? DEFAULT_ASSESSMENT_CONFIG.passing_percent);
  const attempts = Number(o.attempts ?? DEFAULT_ASSESSMENT_CONFIG.attempts);
  const minPractice = Number(
    o.min_practice_per_module ?? DEFAULT_ASSESSMENT_CONFIG.min_practice_per_module
  );
  return {
    passing_percent: Math.min(100, Math.max(1, Number.isFinite(passing) ? passing : 60)),
    attempts: Math.max(1, Number.isFinite(attempts) ? Math.floor(attempts) : 3),
    min_practice_per_module: Math.max(
      0,
      Number.isFinite(minPractice) ? Math.floor(minPractice) : 3
    ),
    require_assessment:
      typeof o.require_assessment === "boolean"
        ? o.require_assessment
        : DEFAULT_ASSESSMENT_CONFIG.require_assessment,
  };
}

export async function getAssessmentConfig(courseId: string): Promise<AssessmentConfig> {
  const row = await queryOne<{ assessment_config: unknown }>(
    `SELECT assessment_config FROM courses WHERE id = $1`,
    [courseId]
  );
  if (!row) throw Object.assign(new Error("Course not found"), { status: 404 });
  return normalizeAssessmentConfig(row.assessment_config);
}

export async function updateAssessmentConfig(
  courseId: string,
  patch: Partial<AssessmentConfig>
): Promise<AssessmentConfig> {
  const current = await getAssessmentConfig(courseId);
  const next = normalizeAssessmentConfig({ ...current, ...patch });
  const row = await queryOne<{ assessment_config: unknown }>(
    `UPDATE courses
     SET assessment_config = $2::jsonb, updated_at = NOW()
     WHERE id = $1
     RETURNING assessment_config`,
    [courseId, JSON.stringify(next)]
  );
  if (!row) throw Object.assign(new Error("Course not found"), { status: 404 });
  return normalizeAssessmentConfig(row.assessment_config);
}

export async function updateAssetMeta(
  assetRowId: string,
  meta: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const row = await queryOne<{ id: string; meta: Record<string, unknown> }>(
    `UPDATE course_module_assets
     SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
     WHERE id = $1
     RETURNING id, meta`,
    [assetRowId, JSON.stringify(meta)]
  );
  if (!row) throw Object.assign(new Error("Asset mapping not found"), { status: 404 });
  return row;
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  module_id?: string;
  module_title?: string;
}

export interface CourseValidationResult {
  ok: boolean;
  config: AssessmentConfig;
  issues: ValidationIssue[];
  stats: {
    modules: number;
    practice: number;
    coding: number;
    assessment: number;
    lesson: number;
  };
}

export async function validateCourse(courseId: string): Promise<CourseValidationResult> {
  const course = await queryOne<{ id: string; assessment_config: unknown; status: string }>(
    `SELECT id, assessment_config, status FROM courses WHERE id = $1`,
    [courseId]
  );
  if (!course) throw Object.assign(new Error("Course not found"), { status: 404 });

  const config = normalizeAssessmentConfig(course.assessment_config);
  const modules = await query<{ id: string; title: string; sort_order: number }>(
    `SELECT id, title, sort_order FROM course_modules WHERE course_id = $1 ORDER BY sort_order`,
    [courseId]
  );
  const assets = (await listCourseAssets(courseId)) as Array<{
    module_id: string;
    module_title?: string;
    role: string;
    asset_type: string;
    meta?: Record<string, unknown>;
  }>;

  const issues: ValidationIssue[] = [];
  const stats = {
    modules: modules.length,
    practice: assets.filter((a) => a.role === "practice").length,
    coding: assets.filter((a) => a.role === "coding").length,
    assessment: assets.filter((a) => a.role === "assessment").length,
    lesson: assets.filter((a) => a.role === "lesson" || a.role === "resource").length,
  };

  if (modules.length === 0) {
    issues.push({
      code: "no_modules",
      severity: "error",
      message: "Add at least one module before publishing.",
    });
  }

  if (config.passing_percent < 1 || config.passing_percent > 100) {
    issues.push({
      code: "passing_percent",
      severity: "error",
      message: "Passing percent must be between 1 and 100.",
    });
  }

  if (config.attempts < 1) {
    issues.push({
      code: "attempts",
      severity: "error",
      message: "Attempts must be at least 1.",
    });
  }

  for (const mod of modules) {
    const modAssets = assets.filter((a) => a.module_id === mod.id);
    const practiceCount = modAssets.filter(
      (a) => a.role === "practice" || a.role === "coding"
    ).length;
    if (practiceCount < config.min_practice_per_module) {
      issues.push({
        code: "min_practice",
        severity: "error",
        module_id: mod.id,
        module_title: mod.title,
        message: `Module “${mod.title}” needs at least ${config.min_practice_per_module} practice/coding items (has ${practiceCount}).`,
      });
    }
  }

  if (config.require_assessment && stats.assessment < 1) {
    issues.push({
      code: "require_assessment",
      severity: "error",
      message: "Attach at least one Knowledge Library item with the Assessment role.",
    });
  }

  if (stats.lesson < 1 && modules.length > 0) {
    issues.push({
      code: "no_lesson_assets",
      severity: "warning",
      message: "No lesson/resource assets attached yet — students may only see practice.",
    });
  }

  const ok = !issues.some((i) => i.severity === "error");
  return { ok, config, issues, stats };
}

export async function publishCourse(courseId: string): Promise<{
  course: Record<string, unknown>;
  validation: CourseValidationResult;
}> {
  const validation = await validateCourse(courseId);
  if (!validation.ok) {
    const err = Object.assign(new Error("Course failed publish validation"), {
      status: 400,
      validation,
    });
    throw err;
  }
  const course = await queryOne(
    `UPDATE courses SET status = 'published', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [courseId]
  );
  if (!course) throw Object.assign(new Error("Course not found"), { status: 404 });
  return { course, validation };
}

export interface CourseBuilderAnalytics {
  dashboard: CourseBuilderDashboard;
  assetMappings: number;
  avgModulesPerCourse: number | null;
  aiOutlineCourses: number;
  templateCourses: number;
  enrollmentsByDomain: { domain: string; enrollments: number }[];
  draftReadyEstimate: number;
  draftBlockedEstimate: number;
  topCourses: {
    id: string;
    title: string;
    status: string;
    category: string;
    enrollments: number;
    modules: number;
    assets: number;
  }[];
}

export async function getAnalytics(): Promise<CourseBuilderAnalytics> {
  const dashboard = await getDashboardSummary();

  const assetRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM course_module_assets`
  );
  const assetMappings = Number(assetRow?.n) || 0;

  const avgRow = await queryOne<{ avg: string | null }>(
    `SELECT ROUND(AVG(total_modules)::numeric, 1)::text AS avg
     FROM courses WHERE status <> 'archived'`
  );
  const avgModulesPerCourse =
    avgRow?.avg != null && avgRow.avg !== "" ? Number(avgRow.avg) : null;

  const aiOutlineRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM courses WHERE 'ai-outline' = ANY(tags)`
  );
  const templateTagRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM courses WHERE 'template' = ANY(tags)`
  );
  const aiOutlineCourses = Number(aiOutlineRow?.n) || 0;
  const templateCourses = Number(templateTagRow?.n) || 0;

  const enrollDomain = await query<{ domain: string; enrollments: string }>(`
    SELECT c.category AS domain, COUNT(e.id)::text AS enrollments
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE c.category = ANY($1::text[])
    GROUP BY c.category
    ORDER BY COUNT(e.id) DESC
  `, [PHASE1_DOMAINS as unknown as string[]]);

  const topCourses = await query<{
    id: string;
    title: string;
    status: string;
    category: string;
    enrollments: string;
    modules: string;
    assets: string;
  }>(`
    SELECT c.id, c.title, c.status, c.category,
      (SELECT COUNT(*)::text FROM enrollments e WHERE e.course_id = c.id) AS enrollments,
      COALESCE(c.total_modules, 0)::text AS modules,
      (SELECT COUNT(*)::text FROM course_module_assets a
         JOIN course_modules m ON m.id = a.module_id WHERE m.course_id = c.id) AS assets
    FROM courses c
    WHERE c.status IN ('draft', 'published')
    ORDER BY (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) DESC, c.updated_at DESC
    LIMIT 8
  `);

  // Estimate ready/blocked among drafts (cap at 20 to keep publish gates honest without full scan)
  const drafts = await query<{ id: string }>(
    `SELECT id FROM courses WHERE status = 'draft' ORDER BY updated_at DESC LIMIT 20`
  );
  let draftReadyEstimate = 0;
  let draftBlockedEstimate = 0;
  for (const d of drafts) {
    try {
      const v = await validateCourse(d.id);
      if (v.ok) draftReadyEstimate += 1;
      else draftBlockedEstimate += 1;
    } catch {
      draftBlockedEstimate += 1;
    }
  }

  return {
    dashboard,
    assetMappings,
    avgModulesPerCourse,
    aiOutlineCourses,
    templateCourses,
    enrollmentsByDomain: enrollDomain.map((r) => ({
      domain: r.domain,
      enrollments: Number(r.enrollments) || 0,
    })),
    draftReadyEstimate,
    draftBlockedEstimate,
    topCourses: topCourses.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      category: c.category,
      enrollments: Number(c.enrollments) || 0,
      modules: Number(c.modules) || 0,
      assets: Number(c.assets) || 0,
    })),
  };
}
