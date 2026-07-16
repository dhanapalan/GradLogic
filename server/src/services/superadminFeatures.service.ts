// =============================================================================
// Backing APIs for Super Admin nav leaves that replaced Coming Soon stubs.
// =============================================================================

import { query, queryOne } from "../config/database.js";

export type ContentLibraryType =
  | "interview_question"
  | "case_study"
  | "learning_resource"
  | "resource";

export async function listFlashcards(filters?: { category?: string; search?: string }) {
  return query(
    `SELECT f.*, u.name AS created_by_name
     FROM flashcards f
     LEFT JOIN users u ON u.id = f.created_by
     WHERE f.is_active = TRUE
       AND ($1::text IS NULL OR f.category = $1)
       AND ($2::text IS NULL OR f.front ILIKE '%' || $2 || '%' OR f.back ILIKE '%' || $2 || '%')
     ORDER BY f.created_at DESC
     LIMIT 500`,
    [filters?.category || null, filters?.search || null]
  );
}

export async function listPublishedLessons(filters?: { voiceOnly?: boolean; search?: string }) {
  const voice = filters?.voiceOnly === true;
  return query(
    `SELECT l.id, l.title, l.content_type, l.content_text, l.content_url,
            l.estimated_minutes, l.sort_order, l.created_at,
            m.id AS module_id, m.title AS module_title,
            c.id AS course_id, c.title AS course_title, c.category AS course_category
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE ($1::boolean IS FALSE OR l.content_type IN ('voice_script', 'audio', 'voice'))
       AND ($2::text IS NULL OR l.title ILIKE '%' || $2 || '%' OR COALESCE(l.content_text,'') ILIKE '%' || $2 || '%')
     ORDER BY c.title, m.sort_order, l.sort_order
     LIMIT 500`,
    [voice, filters?.search || null]
  );
}

export async function listContentLibrary(filters?: {
  content_type?: ContentLibraryType;
  search?: string;
  status?: string;
}) {
  return query(
    `SELECT i.*, u.name AS created_by_name
     FROM content_library_items i
     LEFT JOIN users u ON u.id = i.created_by
     WHERE ($1::text IS NULL OR i.content_type = $1)
       AND ($2::text IS NULL OR i.status = $2)
       AND ($3::text IS NULL OR i.title ILIKE '%' || $3 || '%' OR i.body ILIKE '%' || $3 || '%')
     ORDER BY i.updated_at DESC
     LIMIT 500`,
    [filters?.content_type || null, filters?.status || null, filters?.search || null]
  );
}

export async function createContentLibraryItem(input: {
  content_type: ContentLibraryType;
  title: string;
  body?: string;
  category?: string;
  difficulty?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
  status?: string;
  created_by?: string;
}) {
  return queryOne(
    `INSERT INTO content_library_items
       (content_type, title, body, category, difficulty, tags, meta, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
     RETURNING *`,
    [
      input.content_type,
      input.title,
      input.body || "",
      input.category || "general",
      input.difficulty || "medium",
      input.tags || [],
      JSON.stringify(input.meta || {}),
      input.status || "published",
      input.created_by || null,
    ]
  );
}

export async function updateContentLibraryItem(
  id: string,
  input: Partial<{
    title: string;
    body: string;
    category: string;
    difficulty: string;
    tags: string[];
    meta: Record<string, unknown>;
    status: string;
  }>
) {
  return queryOne(
    `UPDATE content_library_items SET
       title = COALESCE($2, title),
       body = COALESCE($3, body),
       category = COALESCE($4, category),
       difficulty = COALESCE($5, difficulty),
       tags = COALESCE($6, tags),
       meta = COALESCE($7::jsonb, meta),
       status = COALESCE($8, status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.title ?? null,
      input.body ?? null,
      input.category ?? null,
      input.difficulty ?? null,
      input.tags ?? null,
      input.meta ? JSON.stringify(input.meta) : null,
      input.status ?? null,
    ]
  );
}

export async function archiveContentLibraryItem(id: string) {
  return queryOne(
    `UPDATE content_library_items SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
}

export async function listLearningPaths() {
  return query(
    `SELECT lp.*,
            (SELECT COUNT(*)::int FROM learning_path_courses lpc WHERE lpc.path_id = lp.id) AS course_count,
            u.name AS created_by_name
     FROM learning_paths lp
     LEFT JOIN users u ON u.id = lp.created_by
     ORDER BY lp.updated_at DESC`
  );
}

export async function createLearningPath(input: {
  title: string;
  description?: string;
  target_role?: string;
  duration_days?: number;
  created_by?: string;
}) {
  return queryOne(
    `INSERT INTO learning_paths (title, description, target_role, duration_days, status, created_by)
     VALUES ($1,$2,$3,$4,'draft',$5)
     RETURNING *`,
    [
      input.title,
      input.description || null,
      input.target_role || null,
      input.duration_days || null,
      input.created_by || null,
    ]
  );
}

export async function updateLearningPath(
  id: string,
  input: Partial<{ title: string; description: string; target_role: string; duration_days: number; status: string }>
) {
  return queryOne(
    `UPDATE learning_paths SET
       title = COALESCE($2, title),
       description = COALESCE($3, description),
       target_role = COALESCE($4, target_role),
       duration_days = COALESCE($5, duration_days),
       status = COALESCE($6, status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.title ?? null,
      input.description ?? null,
      input.target_role ?? null,
      input.duration_days ?? null,
      input.status ?? null,
    ]
  );
}

export async function listCertificatesAdmin(search?: string) {
  return query(
    `SELECT cert.*,
            COALESCE(u.full_name, u.name) AS student_name, u.email AS student_email,
            c.title AS course_title,
            lp.title AS path_title,
            ad.name AS drive_name
     FROM certificates cert
     JOIN users u ON u.id = cert.student_id
     LEFT JOIN courses c ON c.id = cert.course_id
     LEFT JOIN learning_paths lp ON lp.id = cert.path_id
     LEFT JOIN assessment_drives ad ON ad.id = cert.drive_id
     WHERE ($1::text IS NULL
            OR u.name ILIKE '%' || $1 || '%'
            OR COALESCE(u.full_name, '') ILIKE '%' || $1 || '%'
            OR u.email ILIKE '%' || $1 || '%'
            OR COALESCE(cert.title, c.title, lp.title, ad.name, '') ILIKE '%' || $1 || '%')
     ORDER BY cert.issued_at DESC
     LIMIT 500`,
    [search || null]
  );
}

export async function listBatches(collegeId?: string) {
  return query(
    `SELECT b.*,
            col.name AS college_name,
            (SELECT COUNT(*)::int FROM batch_enrollments be WHERE be.batch_id = b.id AND be.status = 'active') AS student_count
     FROM college_batches b
     JOIN colleges col ON col.id = b.college_id
     WHERE ($1::uuid IS NULL OR b.college_id = $1)
     ORDER BY b.created_at DESC`,
    [collegeId || null]
  );
}

export async function createBatch(input: {
  college_id: string;
  name: string;
  academic_year?: string;
  program_label?: string;
  start_date?: string;
  end_date?: string;
  created_by?: string;
}) {
  return queryOne(
    `INSERT INTO college_batches
       (college_id, name, academic_year, program_label, start_date, end_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.college_id,
      input.name,
      input.academic_year || null,
      input.program_label || null,
      input.start_date || null,
      input.end_date || null,
      input.created_by || null,
    ]
  );
}

export async function updateBatch(
  id: string,
  input: Partial<{
    name: string;
    academic_year: string;
    program_label: string;
    start_date: string;
    end_date: string;
    status: string;
  }>
) {
  return queryOne(
    `UPDATE college_batches SET
       name = COALESCE($2, name),
       academic_year = COALESCE($3, academic_year),
       program_label = COALESCE($4, program_label),
       start_date = COALESCE($5, start_date),
       end_date = COALESCE($6, end_date),
       status = COALESCE($7, status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.name ?? null,
      input.academic_year ?? null,
      input.program_label ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      input.status ?? null,
    ]
  );
}

export async function listBatchEnrollments(batchId?: string, search?: string) {
  return query(
    `SELECT be.*,
            u.name AS student_name, u.email AS student_email,
            b.name AS batch_name, b.college_id,
            col.name AS college_name
     FROM batch_enrollments be
     JOIN users u ON u.id = be.student_id
     JOIN college_batches b ON b.id = be.batch_id
     JOIN colleges col ON col.id = b.college_id
     WHERE ($1::uuid IS NULL OR be.batch_id = $1)
       AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
     ORDER BY be.enrolled_at DESC
     LIMIT 500`,
    [batchId || null, search || null]
  );
}

export async function enrollStudentInBatch(batchId: string, studentId: string) {
  return queryOne(
    `INSERT INTO batch_enrollments (batch_id, student_id)
     VALUES ($1,$2)
     ON CONFLICT (batch_id, student_id) DO UPDATE SET status = 'active'
     RETURNING *`,
    [batchId, studentId]
  );
}

export async function setEnrollmentStatus(id: string, status: string) {
  return queryOne(
    `UPDATE batch_enrollments SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
}

export async function getCourseAnalytics() {
  const courses = await query(
    `SELECT c.id, c.title, c.category, c.status,
            c.total_modules,
            (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS enrollments,
            (SELECT COALESCE(AVG(e.progress_percent),0)::float FROM enrollments e WHERE e.course_id = c.id) AS avg_progress,
            (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.progress_percent >= 100) AS completions
     FROM courses c
     ORDER BY enrollments DESC, c.title
     LIMIT 200`
  );
  const [totals] = await query<{
    courses: number;
    enrollments: number;
    completions: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM courses) AS courses,
       (SELECT COUNT(*)::int FROM enrollments) AS enrollments,
       (SELECT COUNT(*)::int FROM enrollments WHERE progress_percent >= 100) AS completions`
  );
  return { totals: totals || { courses: 0, enrollments: 0, completions: 0 }, courses };
}

export async function getVoiceAnalytics() {
  const [usage] = await query<{ total: string; voice: string }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE feature ILIKE '%voice%' OR feature ILIKE '%tutor%' OR feature ILIKE '%interview%')::int AS voice
     FROM ai_usage_events`
  ).catch(() => [{ total: "0", voice: "0" }]);

  const byFeature = await query(
    `SELECT feature, COUNT(*)::int AS count
     FROM ai_usage_events
     WHERE feature ILIKE '%voice%' OR feature ILIKE '%tutor%' OR feature ILIKE '%interview%'
     GROUP BY feature
     ORDER BY count DESC
     LIMIT 20`
  ).catch(() => []);

  const recent = await query(
    `SELECT feature, created_at, student_id
     FROM ai_usage_events
     WHERE feature ILIKE '%voice%' OR feature ILIKE '%tutor%' OR feature ILIKE '%interview%'
     ORDER BY created_at DESC
     LIMIT 30`
  ).catch(() => []);

  const interviews = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM mock_interview_sessions
     GROUP BY status
     ORDER BY count DESC`
  ).catch(() => []);

  return {
    totals: { events: Number(usage?.total || 0), voiceEvents: Number(usage?.voice || 0) },
    byFeature,
    recent,
    interviews,
  };
}

export async function getLearningAnalytics() {
  const [practice] = await query<{ sessions: string; minutes: string }>(
    `SELECT COUNT(*)::int AS sessions,
            COALESCE(SUM(time_spent_seconds)/60.0,0)::float AS minutes
     FROM practice_sessions
     WHERE status = 'completed' OR completed_at IS NOT NULL`
  ).catch(() => [{ sessions: "0", minutes: "0" }]);

  const coverage = await query(
    `SELECT category, COUNT(*)::int AS questions
     FROM question_bank
     GROUP BY category
     ORDER BY questions DESC
     LIMIT 20`
  ).catch(() => []);

  const lessonCounts = await query(
    `SELECT COALESCE(c.category,'uncategorized') AS category, COUNT(l.id)::int AS lessons
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     GROUP BY c.category
     ORDER BY lessons DESC`
  ).catch(() => []);

  return {
    practice: {
      sessions: Number(practice?.sessions || 0),
      minutes: Number(practice?.minutes || 0),
    },
    questionCoverage: coverage,
    lessonCoverage: lessonCounts,
  };
}
