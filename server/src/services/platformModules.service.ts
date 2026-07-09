import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  ALL_FEATURE_KEYS,
  COLLEGE_CORE_FEATURES,
  FEATURE_CATALOG,
  STUDENT_CORE_FEATURES,
  expandFeatureImplications,
  type PlatformFeatureKey,
} from "../constants/platformFeatures.js";

export interface FeatureModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "active" | "draft" | "archived";
  module_type: "lms" | "platform";
  is_default: boolean;
  sort_order: number;
  icon: string | null;
  features: string[];
  assigned_colleges_count: number;
  created_at: string;
  updated_at: string;
}

export interface EnabledLmsModule {
  key: string;
  name: string;
  description: string | null;
  module_type: "lms" | "platform";
  icon: string | null;
  features: string[];
  sort_order: number;
}

export interface CollegeModuleAssignment {
  module_id: string;
  module_key: string;
  module_name: string;
  description: string | null;
  module_type: "lms" | "platform";
  is_default: boolean;
  icon: string | null;
  sort_order: number;
  features: string[];
  enabled: boolean;
  assigned_at: string;
}

const MODULE_SELECT = `
  id, key, name, description, status,
  COALESCE(module_type, 'lms') AS module_type,
  COALESCE(is_default, false) AS is_default,
  COALESCE(sort_order, 0) AS sort_order,
  icon,
  features, created_at, updated_at,
  (
    SELECT COUNT(*)::int FROM college_module_assignments cma
    WHERE cma.module_id = feature_modules.id AND cma.enabled = true
  ) AS assigned_colleges_count
`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function validateFeatures(features: string[]): string[] {
  const valid = new Set(ALL_FEATURE_KEYS);
  const cleaned = [...new Set(features.filter((f) => valid.has(f as PlatformFeatureKey)))];
  if (cleaned.length === 0) {
    throw new AppError("At least one valid feature is required", 400);
  }
  return cleaned;
}

function mapModuleRow(row: Record<string, unknown>): FeatureModule {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    status: String(row.status) as FeatureModule["status"],
    module_type: (String(row.module_type) === "platform" ? "platform" : "lms") as FeatureModule["module_type"],
    is_default: Boolean(row.is_default),
    sort_order: Number(row.sort_order) || 0,
    icon: row.icon != null ? String(row.icon) : null,
    features: parseFeatures(row.features),
    assigned_colleges_count: Number(row.assigned_colleges_count) || 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Number of colleges that currently have this module enabled. */
export async function countCollegesUsingModule(moduleId: string): Promise<number> {
  const row = await queryOne(
    `SELECT COUNT(*)::int AS count
     FROM college_module_assignments
     WHERE module_id = $1 AND enabled = true`,
    [moduleId]
  );
  return Number((row as Record<string, unknown> | null)?.count) || 0;
}

/** List all feature modules (SuperAdmin). */
export async function listModules(status?: string): Promise<FeatureModule[]> {
  let sql = `
    SELECT ${MODULE_SELECT}
    FROM feature_modules
    WHERE deleted_at IS NULL
  `;
  const params: unknown[] = [];
  if (status) {
    sql += ` AND status = $1`;
    params.push(status);
  }
  sql += ` ORDER BY sort_order ASC, name ASC`;
  const rows = await query(sql, params);
  return rows.map((r) => mapModuleRow(r as Record<string, unknown>));
}

export async function getModuleById(id: string): Promise<FeatureModule> {
  const row = await queryOne(
    `SELECT ${MODULE_SELECT} FROM feature_modules WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!row) throw new AppError("Module not found", 404);
  return mapModuleRow(row as Record<string, unknown>);
}

export async function createModule(input: {
  name: string;
  description?: string;
  status?: string;
  features: string[];
  key?: string;
  module_type?: "lms" | "platform";
  is_default?: boolean;
  sort_order?: number;
  icon?: string;
}): Promise<FeatureModule> {
  const features = validateFeatures(input.features);
  const key = input.key?.trim() || slugify(input.name);
  if (!key) throw new AppError("Invalid module key", 400);

  const existing = await queryOne(
    `SELECT id FROM feature_modules WHERE key = $1 AND deleted_at IS NULL`,
    [key]
  );
  if (existing) throw new AppError("A module with this key already exists", 409);

  const status = input.status ?? "active";
  const moduleType = input.module_type ?? "lms";
  const result = await queryOne(
    `INSERT INTO feature_modules (key, name, description, status, features, module_type, is_default, sort_order, icon)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     RETURNING ${MODULE_SELECT}`,
    [
      key,
      input.name.trim(),
      input.description ?? null,
      status,
      JSON.stringify(features),
      moduleType,
      input.is_default ?? false,
      input.sort_order ?? 0,
      input.icon ?? null,
    ]
  );
  return mapModuleRow(result as Record<string, unknown>);
}

export async function updateModule(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    status: string;
    features: string[];
    module_type: "lms" | "platform";
    is_default: boolean;
    sort_order: number;
    icon: string;
  }>
): Promise<FeatureModule> {
  const current = await getModuleById(id);

  // Guard: cannot deactivate/archive a module that colleges are actively using.
  const isDeactivating =
    input.status !== undefined && input.status !== "active" && current.status === "active";
  if (isDeactivating) {
    const inUse = await countCollegesUsingModule(id);
    if (inUse > 0) {
      throw new AppError(
        `Cannot deactivate: this module is enabled for ${inUse} college${inUse === 1 ? "" : "s"}. Disable it for all colleges first.`,
        409
      );
    }
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${idx++}`);
    params.push(input.name.trim());
  }
  if (input.description !== undefined) {
    fields.push(`description = $${idx++}`);
    params.push(input.description);
  }
  if (input.status !== undefined) {
    fields.push(`status = $${idx++}`);
    params.push(input.status);
  }
  if (input.features !== undefined) {
    fields.push(`features = $${idx++}::jsonb`);
    params.push(JSON.stringify(validateFeatures(input.features)));
  }
  if (input.module_type !== undefined) {
    fields.push(`module_type = $${idx++}`);
    params.push(input.module_type);
  }
  if (input.is_default !== undefined) {
    fields.push(`is_default = $${idx++}`);
    params.push(input.is_default);
  }
  if (input.sort_order !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    params.push(input.sort_order);
  }
  if (input.icon !== undefined) {
    fields.push(`icon = $${idx++}`);
    params.push(input.icon);
  }

  if (fields.length === 0) return getModuleById(id);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await queryOne(
    `UPDATE feature_modules SET ${fields.join(", ")}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING ${MODULE_SELECT}`,
    params
  );
  return mapModuleRow(result as Record<string, unknown>);
}

export async function deleteModule(id: string): Promise<void> {
  const row = await queryOne(
    `SELECT id FROM feature_modules WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!row) throw new AppError("Module not found", 404);

  const inUse = await countCollegesUsingModule(id);
  if (inUse > 0) {
    throw new AppError(
      `Cannot delete: this module is enabled for ${inUse} college${inUse === 1 ? "" : "s"}. Disable it for all colleges first.`,
      409
    );
  }

  await query(
    `UPDATE feature_modules SET deleted_at = NOW(), status = 'archived', updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

/** Assignments for a college with module metadata. */
export async function getCollegeModuleAssignments(
  collegeId: string
): Promise<CollegeModuleAssignment[]> {
  const college = await queryOne(`SELECT id FROM colleges WHERE id = $1`, [collegeId]);
  if (!college) throw new AppError("College not found", 404);

  const rows = await query(
    `SELECT
       fm.id AS module_id,
       fm.key AS module_key,
       fm.name AS module_name,
       fm.description,
       COALESCE(fm.module_type, 'lms') AS module_type,
       COALESCE(fm.is_default, false) AS is_default,
       fm.icon,
       COALESCE(fm.sort_order, 0) AS sort_order,
       fm.features,
       COALESCE(cma.enabled, false) AS enabled,
       cma.assigned_at
     FROM feature_modules fm
     LEFT JOIN college_module_assignments cma
       ON cma.module_id = fm.id AND cma.college_id = $1
     WHERE fm.deleted_at IS NULL AND fm.status = 'active'
     ORDER BY fm.sort_order ASC, fm.name ASC`,
    [collegeId]
  );

  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      module_id: String(row.module_id),
      module_key: String(row.module_key),
      module_name: String(row.module_name),
      description: row.description != null ? String(row.description) : null,
      module_type: (String(row.module_type) === "platform" ? "platform" : "lms") as CollegeModuleAssignment["module_type"],
      is_default: Boolean(row.is_default),
      icon: row.icon != null ? String(row.icon) : null,
      sort_order: Number(row.sort_order) || 0,
      features: parseFeatures(row.features),
      enabled: Boolean(row.enabled),
      assigned_at: row.assigned_at ? String(row.assigned_at) : "",
    };
  });
}

/** Replace college module enablement (upsert per module). */
export async function setCollegeModuleAssignments(
  collegeId: string,
  assignments: { module_id: string; enabled: boolean }[],
  assignedBy?: string
): Promise<CollegeModuleAssignment[]> {
  const college = await queryOne(`SELECT id FROM colleges WHERE id = $1`, [collegeId]);
  if (!college) throw new AppError("College not found", 404);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const { module_id, enabled } of assignments) {
      const mod = await client.query(
        `SELECT id FROM feature_modules WHERE id = $1 AND deleted_at IS NULL`,
        [module_id]
      );
      if (mod.rows.length === 0) {
        throw new AppError(`Module ${module_id} not found`, 404);
      }

      if (enabled) {
        await client.query(
          `INSERT INTO college_module_assignments (college_id, module_id, enabled, assigned_by)
           VALUES ($1, $2, true, $3)
           ON CONFLICT (college_id, module_id)
           DO UPDATE SET enabled = true, assigned_at = NOW(), assigned_by = EXCLUDED.assigned_by`,
          [collegeId, module_id, assignedBy ?? null]
        );
      } else {
        await client.query(
          `INSERT INTO college_module_assignments (college_id, module_id, enabled, assigned_by)
           VALUES ($1, $2, false, $3)
           ON CONFLICT (college_id, module_id)
           DO UPDATE SET enabled = false, assigned_at = NOW()`,
          [collegeId, module_id, assignedBy ?? null]
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getCollegeModuleAssignments(collegeId);
}

/** Enable modules marked is_default for a college (overwrites all assignments). */
export async function assignDefaultModulesToCollege(
  collegeId: string,
  assignedBy?: string
): Promise<CollegeModuleAssignment[]> {
  const rows = await query(
    `SELECT id, COALESCE(is_default, false) AS is_default
     FROM feature_modules
     WHERE deleted_at IS NULL AND status = 'active'`
  );

  if (rows.length === 0) {
    return getCollegeModuleAssignments(collegeId);
  }

  const assignments = rows.map((r) => ({
    module_id: String((r as Record<string, unknown>).id),
    enabled: Boolean((r as Record<string, unknown>).is_default),
  }));

  return setCollegeModuleAssignments(collegeId, assignments, assignedBy);
}

/**
 * Resolved enabled feature keys for a college.
 * If no modules are assigned, returns all features (backward compatible).
 */
export async function getEnabledFeaturesForCollege(
  collegeId: string
): Promise<PlatformFeatureKey[]> {
  const rows = await query(
    `SELECT fm.features
     FROM college_module_assignments cma
     JOIN feature_modules fm ON fm.id = cma.module_id
     WHERE cma.college_id = $1 AND cma.enabled = true
       AND fm.deleted_at IS NULL AND fm.status = 'active'`,
    [collegeId]
  );

  if (rows.length === 0) {
    return [...ALL_FEATURE_KEYS];
  }

  const set = new Set<PlatformFeatureKey>(COLLEGE_CORE_FEATURES);
  for (const row of rows) {
    for (const f of parseFeatures((row as Record<string, unknown>).features)) {
      if (ALL_FEATURE_KEYS.includes(f as PlatformFeatureKey)) {
        set.add(f as PlatformFeatureKey);
      }
    }
  }
  return expandFeatureImplications([...set]);
}

/** Student-facing features derived from college assignments + student core. */
export async function getEnabledFeaturesForStudent(
  collegeId: string | null | undefined
): Promise<PlatformFeatureKey[]> {
  if (!collegeId) {
    return [...ALL_FEATURE_KEYS];
  }

  const rows = await query(
    `SELECT fm.features
     FROM college_module_assignments cma
     JOIN feature_modules fm ON fm.id = cma.module_id
     WHERE cma.college_id = $1 AND cma.enabled = true
       AND fm.deleted_at IS NULL AND fm.status = 'active'`,
    [collegeId]
  );

  if (rows.length === 0) {
    return [...ALL_FEATURE_KEYS];
  }

  const studentKeys = new Set(
    FEATURE_CATALOG.filter((f) => f.portal === "student" || f.portal === "both").map((f) => f.key)
  );

  // Collect raw grants first, expand implications (e.g. aptitude_practice →
  // practice), then keep only student-portal features.
  const granted = new Set<PlatformFeatureKey>();
  for (const row of rows) {
    for (const f of parseFeatures((row as Record<string, unknown>).features)) {
      if (ALL_FEATURE_KEYS.includes(f as PlatformFeatureKey)) {
        granted.add(f as PlatformFeatureKey);
      }
    }
  }
  const set = new Set<PlatformFeatureKey>(STUDENT_CORE_FEATURES);
  for (const f of expandFeatureImplications([...granted])) {
    if (studentKeys.has(f)) set.add(f);
  }
  return [...set];
}

/** Enabled LMS module groups for portal navigation. */
export async function getEnabledLmsModulesForCollege(
  collegeId: string
): Promise<EnabledLmsModule[]> {
  const rows = await query(
    `SELECT fm.key, fm.name, fm.description,
            COALESCE(fm.module_type, 'lms') AS module_type,
            fm.icon, fm.features, COALESCE(fm.sort_order, 0) AS sort_order
     FROM college_module_assignments cma
     JOIN feature_modules fm ON fm.id = cma.module_id
     WHERE cma.college_id = $1 AND cma.enabled = true
       AND fm.deleted_at IS NULL AND fm.status = 'active'
       AND COALESCE(fm.module_type, 'lms') = 'lms'
     ORDER BY fm.sort_order ASC, fm.name ASC`,
    [collegeId]
  );

  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      key: String(row.key),
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      module_type: "lms" as const,
      icon: row.icon != null ? String(row.icon) : null,
      features: parseFeatures(row.features),
      sort_order: Number(row.sort_order) || 0,
    };
  });
}

export function getFeatureCatalog() {
  return FEATURE_CATALOG;
}

// ── LMS module content (courses + practice topics + student progress) ────────

export interface ModuleCourse {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  duration_hours: number | null;
  total_modules: number;
  enrollment_count: number;
  // Student-only fields (null for non-students)
  enrollment_status: string | null;
  progress_percent: number | null;
}

export interface ModulePracticeTopic {
  topic: string;
  total_questions: number;
  easy: number;
  medium: number;
  hard: number;
  // Student-only fields
  sessions_completed: number | null;
  avg_score: number | null;
}

export interface LmsModuleContent {
  module: EnabledLmsModule & { question_categories: string[] };
  courses: ModuleCourse[];
  practice_topics: ModulePracticeTopic[];
  student: {
    enrolled_courses: number;
    completed_courses: number;
    lessons_completed: number;
    practice_sessions: number;
    avg_practice_score: number | null;
  } | null;
}

/**
 * Real content behind an LMS module group: published courses tagged with the
 * module key, practice coverage for its question-bank categories, and (for
 * students) enrollment + practice progress.
 */
export async function getLmsModuleContent(
  moduleKey: string,
  opts: { collegeId?: string | null; studentId?: string | null }
): Promise<LmsModuleContent> {
  const moduleRow = await queryOne(
    `SELECT key, name, description,
            COALESCE(module_type, 'lms') AS module_type,
            icon, features, COALESCE(sort_order, 0) AS sort_order,
            COALESCE(question_categories, '[]'::jsonb) AS question_categories
     FROM feature_modules
     WHERE key = $1 AND deleted_at IS NULL AND status = 'active'`,
    [moduleKey]
  );
  if (!moduleRow) throw new AppError("Module not found", 404);

  // A college-scoped user only sees modules enabled for their college.
  if (opts.collegeId) {
    const enabled = await queryOne(
      `SELECT 1
       FROM college_module_assignments cma
       JOIN feature_modules fm ON fm.id = cma.module_id
       WHERE cma.college_id = $1 AND fm.key = $2 AND cma.enabled = true`,
      [opts.collegeId, moduleKey]
    );
    if (!enabled) throw new AppError("Module not enabled for your campus", 403);
  }

  const row = moduleRow as Record<string, unknown>;
  const questionCategories = parseFeatures(row.question_categories);
  const studentId = opts.studentId ?? null;

  const courseRows = await query(
    `SELECT c.id, c.title, c.description, c.category, c.difficulty,
            c.duration_hours, c.total_modules,
            (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count,
            se.status AS enrollment_status,
            se.progress_percent
     FROM courses c
     LEFT JOIN enrollments se ON se.course_id = c.id AND se.student_id = $2
     WHERE c.module_key = $1 AND c.status = 'published'
       AND (c.college_id IS NULL OR c.college_id = $3)
     ORDER BY c.difficulty = 'beginner' DESC, c.created_at ASC`,
    [moduleKey, studentId, opts.collegeId ?? null]
  );

  const courses: ModuleCourse[] = courseRows.map((r) => {
    const c = r as Record<string, unknown>;
    return {
      id: String(c.id),
      title: String(c.title),
      description: c.description != null ? String(c.description) : null,
      category: String(c.category),
      difficulty: String(c.difficulty ?? "beginner"),
      duration_hours: c.duration_hours != null ? Number(c.duration_hours) : null,
      total_modules: Number(c.total_modules) || 0,
      enrollment_count: Number(c.enrollment_count) || 0,
      enrollment_status: c.enrollment_status != null ? String(c.enrollment_status) : null,
      progress_percent: c.progress_percent != null ? Number(c.progress_percent) : null,
    };
  });

  let practiceTopics: ModulePracticeTopic[] = [];
  if (questionCategories.length > 0) {
    const topicRows = await query(
      `SELECT t.topic, t.total_questions, t.easy, t.medium, t.hard,
              ps.sessions_completed, ps.avg_score
       FROM (
         SELECT category::text AS topic,
                COUNT(*)::int AS total_questions,
                COUNT(*) FILTER (WHERE difficulty_level = 'easy')::int   AS easy,
                COUNT(*) FILTER (WHERE difficulty_level = 'medium')::int AS medium,
                COUNT(*) FILTER (WHERE difficulty_level = 'hard')::int   AS hard
         FROM question_bank
         WHERE is_active = TRUE AND category::text = ANY($1)
         GROUP BY category
       ) t
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS sessions_completed,
                ROUND(AVG(score_percent), 1) AS avg_score
         FROM practice_sessions
         WHERE student_id = $2::uuid AND topic = t.topic AND status = 'completed'
       ) ps ON $2::uuid IS NOT NULL
       ORDER BY t.topic`,
      [questionCategories, studentId]
    );
    practiceTopics = topicRows.map((r) => {
      const t = r as Record<string, unknown>;
      return {
        topic: String(t.topic),
        total_questions: Number(t.total_questions) || 0,
        easy: Number(t.easy) || 0,
        medium: Number(t.medium) || 0,
        hard: Number(t.hard) || 0,
        sessions_completed: t.sessions_completed != null ? Number(t.sessions_completed) : null,
        avg_score: t.avg_score != null ? Number(t.avg_score) : null,
      };
    });
  }

  let student: LmsModuleContent["student"] = null;
  if (studentId) {
    const [enrollStats, lessonStats, practiceStats] = await Promise.all([
      queryOne(
        `SELECT COUNT(*)::int AS enrolled,
                COUNT(*) FILTER (WHERE e.status = 'completed')::int AS completed
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.student_id = $1 AND c.module_key = $2`,
        [studentId, moduleKey]
      ),
      queryOne(
        `SELECT COUNT(*)::int AS lessons_completed
         FROM lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN course_modules cm ON cm.id = l.module_id
         JOIN courses c ON c.id = cm.course_id
         WHERE lp.student_id = $1 AND lp.is_completed = TRUE AND c.module_key = $2`,
        [studentId, moduleKey]
      ),
      questionCategories.length > 0
        ? queryOne(
            `SELECT COUNT(*)::int AS sessions,
                    ROUND(AVG(score_percent), 1) AS avg_score
             FROM practice_sessions
             WHERE student_id = $1 AND status = 'completed' AND topic = ANY($2)`,
            [studentId, questionCategories]
          )
        : Promise.resolve(null),
    ]);

    const es = enrollStats as Record<string, unknown> | null;
    const ls = lessonStats as Record<string, unknown> | null;
    const ps = practiceStats as Record<string, unknown> | null;
    student = {
      enrolled_courses: Number(es?.enrolled) || 0,
      completed_courses: Number(es?.completed) || 0,
      lessons_completed: Number(ls?.lessons_completed) || 0,
      practice_sessions: Number(ps?.sessions) || 0,
      avg_practice_score: ps?.avg_score != null ? Number(ps.avg_score) : null,
    };
  }

  return {
    module: {
      key: String(row.key),
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      module_type: (String(row.module_type) === "platform" ? "platform" : "lms") as "lms" | "platform",
      icon: row.icon != null ? String(row.icon) : null,
      features: parseFeatures(row.features),
      sort_order: Number(row.sort_order) || 0,
      question_categories: questionCategories,
    },
    courses,
    practice_topics: practiceTopics,
    student,
  };
}
