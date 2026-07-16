/**
 * Student Portal Module 04 — My Learning facade.
 * Thin adapters over LMS enrollments, paths, lessons, certificates,
 * assessments, and recommendation signals. No course-authoring logic.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import * as dashboard from "./studentDashboard.service.js";

let schemaReady: Promise<void> | null = null;

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS student_learning_bookmarks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_type TEXT NOT NULL CHECK (target_type IN ('course','lesson','resource')),
          target_id UUID NOT NULL,
          title TEXT,
          href TEXT,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, target_type, target_id)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_student_learning_bookmarks_user
          ON student_learning_bookmarks (user_id, created_at DESC)
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function statusFromProgress(progress: number, enrolled: boolean): "not_started" | "in_progress" | "completed" {
  if (!enrolled || progress <= 0) return "not_started";
  if (progress >= 100) return "completed";
  return "in_progress";
}

/** GET /learning/summary */
export async function getSummary(studentId: string) {
  await ensureSchema();
  const [courses, certs, streak, hours] = await Promise.all([
    queryOne<{
      total: number;
      in_progress: number;
      completed: number;
      avg_progress: number;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (
           WHERE (COALESCE(e.progress_percent, 0) < 100 OR e.status IS DISTINCT FROM 'completed')
             AND (
               COALESCE(e.progress_percent, 0) > 0
               OR EXISTS (
                 SELECT 1 FROM lesson_progress lp
                 JOIN lessons l ON l.id = lp.lesson_id
                 JOIN course_modules m ON m.id = l.module_id
                 WHERE m.course_id = e.course_id AND lp.student_id = e.student_id
               )
             )
         )::int AS in_progress,
         COUNT(*) FILTER (WHERE COALESCE(e.progress_percent, 0) >= 100 OR e.status = 'completed')::int AS completed,
         COALESCE(ROUND(AVG(COALESCE(e.progress_percent, 0)))::int, 0) AS avg_progress
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id AND c.status = 'published'
       WHERE e.student_id = $1`,
      [studentId]
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM certificates WHERE student_id = $1`,
      [studentId]
    ).catch(() => ({ n: 0 })),
    queryOne<{ days: number }>(
      `SELECT COUNT(DISTINCT DATE(last_accessed))::int AS days
       FROM lesson_progress
       WHERE student_id = $1
         AND last_accessed >= NOW() - INTERVAL '30 days'`,
      [studentId]
    ).catch(() => ({ days: 0 })),
    queryOne<{ hours: number }>(
      `SELECT COALESCE(ROUND(SUM(watch_seconds) / 3600.0, 1), 0)::float AS hours
       FROM lesson_progress WHERE student_id = $1`,
      [studentId]
    ).catch(() => ({ hours: 0 })),
  ]);

  const total = courses?.total ?? 0;
  const completed = courses?.completed ?? 0;
  const inProgress = courses?.in_progress ?? 0;

  return {
    total_assigned_courses: total,
    courses_in_progress: inProgress,
    completed_courses: completed,
    learning_hours: hours?.hours ?? 0,
    certificates_earned: certs?.n ?? 0,
    learning_streak_days: streak?.days ?? 0,
    overall_progress_percent: courses?.avg_progress ?? 0,
  };
}

/** GET /learning/dashboard — compose independent widget payloads. */
export async function getDashboard(studentId: string) {
  const [summary, continueLearning, paths, courses, recommendations, deadlines] = await Promise.all([
    getSummary(studentId),
    getContinueLearning(studentId),
    listPaths(studentId).then((p) => p.slice(0, 6)),
    listCourses(studentId, {}).then((c) => c.slice(0, 8)),
    getRecommendations(studentId),
    getLearningEvents(studentId, 21).then((e) => e.slice(0, 8)),
  ]);

  return {
    summary,
    continue_learning: continueLearning,
    paths,
    courses,
    recommendations,
    upcoming_deadlines: deadlines,
  };
}

/**
 * Resume card:
 * 1) last incomplete lesson in progress, else
 * 2) next lesson after the most recently completed one, else
 * 3) any in-progress enrollment.
 */
export async function getContinueLearning(studentId: string) {
  const incomplete = await queryOne<{
    course_id: string;
    course_title: string;
    thumbnail_url: string | null;
    progress_percent: number;
    lesson_id: string;
    lesson_title: string;
    watch_seconds: number;
    video_duration_seconds: number | null;
    last_accessed: string;
  }>(
    `SELECT c.id AS course_id, c.title AS course_title, c.thumbnail_url,
            COALESCE(e.progress_percent, 0)::float AS progress_percent,
            l.id AS lesson_id, l.title AS lesson_title,
            COALESCE(lp.watch_seconds, 0)::int AS watch_seconds,
            l.video_duration_seconds,
            lp.last_accessed::text AS last_accessed
     FROM lesson_progress lp
     JOIN lessons l ON l.id = lp.lesson_id
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = lp.student_id
     WHERE lp.student_id = $1
       AND COALESCE(lp.is_completed, FALSE) = FALSE
     ORDER BY lp.last_accessed DESC NULLS LAST
     LIMIT 1`,
    [studentId]
  );

  if (incomplete) {
    const duration = incomplete.video_duration_seconds || 0;
    const remainingSec = duration > 0 ? Math.max(0, duration - incomplete.watch_seconds) : null;
    return {
      ...incomplete,
      estimated_remaining_minutes: remainingSec != null ? Math.ceil(remainingSec / 60) : null,
      resume_from: "in_progress_lesson" as const,
    };
  }

  // After last completed lesson → resume at the next lesson in course order.
  const afterCompleted = await queryOne<{
    course_id: string;
    course_title: string;
    thumbnail_url: string | null;
    progress_percent: number;
    lesson_id: string;
    lesson_title: string;
    last_accessed: string | null;
  }>(
    `WITH last_done AS (
       SELECT l.id AS lesson_id, c.id AS course_id, m.sort_order AS module_order, l.sort_order AS lesson_order,
              lp.completed_at, lp.last_accessed
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN course_modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE lp.student_id = $1 AND lp.is_completed = TRUE
       ORDER BY COALESCE(lp.completed_at, lp.last_accessed) DESC NULLS LAST
       LIMIT 1
     ),
     ordered AS (
       SELECT l.id, l.title, c.id AS course_id, c.title AS course_title, c.thumbnail_url,
              COALESCE(e.progress_percent, 0)::float AS progress_percent,
              m.sort_order AS module_order, l.sort_order AS lesson_order
       FROM last_done ld
       JOIN course_modules m ON m.course_id = ld.course_id
       JOIN lessons l ON l.module_id = m.id
       JOIN courses c ON c.id = ld.course_id
       JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
     )
     SELECT o.course_id, o.course_title, o.thumbnail_url, o.progress_percent,
            o.id AS lesson_id, o.title AS lesson_title, ld.last_accessed::text AS last_accessed
     FROM ordered o
     CROSS JOIN last_done ld
     WHERE (o.module_order, o.lesson_order) > (ld.module_order, ld.lesson_order)
     ORDER BY o.module_order, o.lesson_order
     LIMIT 1`,
    [studentId]
  );

  if (afterCompleted) {
    return {
      ...afterCompleted,
      watch_seconds: 0,
      estimated_remaining_minutes: null as number | null,
      resume_from: "after_last_completed" as const,
    };
  }

  const enroll = await queryOne<{
    course_id: string;
    course_title: string;
    thumbnail_url: string | null;
    progress_percent: number;
  }>(
    `SELECT c.id AS course_id, c.title AS course_title, c.thumbnail_url,
            COALESCE(e.progress_percent, 0)::float AS progress_percent
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1
       AND COALESCE(e.progress_percent, 0) < 100
     ORDER BY e.enrolled_at DESC
     LIMIT 1`,
    [studentId]
  );
  if (!enroll) return null;
  return {
    ...enroll,
    lesson_id: null as string | null,
    lesson_title: null as string | null,
    watch_seconds: 0,
    estimated_remaining_minutes: null as number | null,
    last_accessed: null as string | null,
    resume_from: "enrollment" as const,
  };
}

/** GET /learning/paths */
export async function listPaths(studentId: string) {
  const rows = await query<{
    id: string;
    title: string;
    description: string | null;
    target_role: string | null;
    duration_days: number | null;
    thumbnail_url: string | null;
    course_count: number;
    enrolled_count: number;
    avg_progress: number;
    due_date: string | null;
  }>(
    `SELECT lp.id, lp.title, lp.description, lp.target_role, lp.duration_days, lp.thumbnail_url,
            COUNT(DISTINCT lpc.course_id)::int AS course_count,
            COUNT(DISTINCT e.id)::int AS enrolled_count,
            COALESCE(ROUND(AVG(e.progress_percent) FILTER (WHERE e.id IS NOT NULL))::int, 0) AS avg_progress,
            NULL::text AS due_date
     FROM learning_paths lp
     LEFT JOIN learning_path_courses lpc ON lpc.path_id = lp.id
     LEFT JOIN enrollments e ON e.course_id = lpc.course_id AND e.student_id = $1
     WHERE lp.status = 'published'
     GROUP BY lp.id
     ORDER BY lp.created_at DESC`,
    [studentId]
  );

  return rows.map((r) => ({
    ...r,
    progress_percent: r.avg_progress,
    status: statusFromProgress(r.avg_progress, r.enrolled_count > 0),
  }));
}

/** GET /learning/paths/:id */
export async function getPath(studentId: string, pathId: string) {
  const path = await queryOne<{
    id: string;
    title: string;
    description: string | null;
    target_role: string | null;
    duration_days: number | null;
    thumbnail_url: string | null;
  }>(`SELECT id, title, description, target_role, duration_days, thumbnail_url
      FROM learning_paths WHERE id = $1 AND status = 'published'`, [pathId]);
  if (!path) throw new AppError("Learning path not found", 404);

  const courses = await query<{
    course_id: string;
    title: string;
    category: string | null;
    difficulty: string | null;
    thumbnail_url: string | null;
    sort_order: number;
    is_required: boolean;
    enrolled: boolean;
    progress_percent: number;
    status: string;
  }>(
    `SELECT c.id AS course_id, c.title, c.category, c.difficulty, c.thumbnail_url,
            lpc.sort_order, COALESCE(lpc.is_required, TRUE) AS is_required,
            (e.id IS NOT NULL) AS enrolled,
            COALESCE(e.progress_percent, 0)::float AS progress_percent,
            COALESCE(e.status, 'not_enrolled') AS status
     FROM learning_path_courses lpc
     JOIN courses c ON c.id = lpc.course_id
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = $2
     WHERE lpc.path_id = $1
     ORDER BY lpc.sort_order`,
    [pathId, studentId]
  );

  const enrolled = courses.filter((c) => c.enrolled);
  const avg =
    enrolled.length > 0
      ? Math.round(enrolled.reduce((s, c) => s + Number(c.progress_percent), 0) / enrolled.length)
      : 0;

  return {
    ...path,
    course_count: courses.length,
    progress_percent: avg,
    status: statusFromProgress(avg, enrolled.length > 0),
    courses,
  };
}

export type CourseFilters = {
  status?: string;
  category?: string;
  difficulty?: string;
  skill?: string;
  search?: string;
  scope?: string; // all | assigned | in_progress | completed | overdue
};

/** GET /learning/courses — student enrollments + filterable catalog slice. */
export async function listCourses(studentId: string, filters: CourseFilters) {
  const rows = await query<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    difficulty: string | null;
    duration_hours: number | null;
    thumbnail_url: string | null;
    instructor_name: string | null;
    tags: string[] | null;
    enrolled_at: string | null;
    progress_percent: number;
    enrollment_status: string | null;
    last_accessed: string | null;
    due_date: string | null;
    is_assigned: boolean;
  }>(
    `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.duration_hours,
            c.thumbnail_url, c.tags, u.name AS instructor_name,
            e.enrolled_at::text AS enrolled_at,
            COALESCE(e.progress_percent, 0)::float AS progress_percent,
            e.status AS enrollment_status,
            (
              SELECT MAX(lp.last_accessed)::text
              FROM lesson_progress lp
              JOIN lessons l ON l.id = lp.lesson_id
              JOIN course_modules m ON m.id = l.module_id
              WHERE m.course_id = c.id AND lp.student_id = $1
            ) AS last_accessed,
            NULL::text AS due_date,
            (e.id IS NOT NULL) AS is_assigned
     FROM courses c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
     WHERE c.status = 'published'
       AND (
         e.id IS NOT NULL
         OR NOT EXISTS (SELECT 1 FROM course_college_assignments cca WHERE cca.course_id = c.id)
         OR EXISTS (
           SELECT 1 FROM course_college_assignments cca
           JOIN users stu ON stu.id = $1
           WHERE cca.course_id = c.id AND cca.college_id = stu.college_id
         )
       )
       AND ($2::text IS NULL OR c.category = $2)
       AND ($3::text IS NULL OR c.difficulty = $3)
       AND ($4::text IS NULL OR c.title ILIKE '%' || $4 || '%' OR c.description ILIKE '%' || $4 || '%')
       AND ($5::text IS NULL OR EXISTS (
         SELECT 1 FROM unnest(COALESCE(c.tags, ARRAY[]::text[])) t WHERE t ILIKE '%' || $5 || '%'
       ))
     ORDER BY e.enrolled_at DESC NULLS LAST, c.created_at DESC`,
    [
      studentId,
      filters.category || null,
      filters.difficulty || null,
      filters.search || null,
      filters.skill || null,
    ]
  );

  let mapped = rows.map((r) => {
    const progress = Number(r.progress_percent) || 0;
    const completion_status = !r.is_assigned
      ? "available"
      : statusFromProgress(progress, true);
    return {
      ...r,
      progress_percent: progress,
      completion_status,
      is_overdue: false,
    };
  });

  const scope = (filters.scope || filters.status || "all").toLowerCase();
  if (scope === "assigned") mapped = mapped.filter((c) => c.is_assigned);
  else if (scope === "in_progress") mapped = mapped.filter((c) => c.completion_status === "in_progress");
  else if (scope === "completed") mapped = mapped.filter((c) => c.completion_status === "completed");
  else if (scope === "overdue") mapped = mapped.filter((c) => c.is_overdue);

  return mapped;
}

/** GET /learning/courses/:id */
export async function getCourse(studentId: string, courseId: string) {
  const course = await queryOne<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    difficulty: string | null;
    duration_hours: number | null;
    thumbnail_url: string | null;
    intro_video_url: string | null;
    tags: string[] | null;
    instructor_name: string | null;
    estimated_minutes: number | null;
  }>(
    `SELECT c.*, u.name AS instructor_name
     FROM courses c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = $1 AND c.status = 'published'`,
    [courseId]
  );
  if (!course) throw new AppError("Course not found", 404);

  const enrollment = await queryOne<{
    id: string;
    progress_percent: number;
    status: string;
    enrolled_at: string;
  }>(
    `SELECT id, COALESCE(progress_percent, 0)::float AS progress_percent, status, enrolled_at::text
     FROM enrollments WHERE student_id = $1 AND course_id = $2`,
    [studentId, courseId]
  );

  const modules = await query<{
    id: string;
    title: string;
    sort_order: number;
    estimated_minutes: number | null;
    lessons: unknown;
  }>(
    `SELECT m.id, m.title, m.sort_order, m.estimated_minutes,
            COALESCE(json_agg(
              json_build_object(
                'id', l.id,
                'title', l.title,
                'content_type', l.content_type,
                'content_url', l.content_url,
                'sort_order', l.sort_order,
                'video_duration_seconds', l.video_duration_seconds,
                'is_free_preview', l.is_free_preview,
                'estimated_minutes', l.estimated_minutes,
                'is_completed', COALESCE(lp.is_completed, FALSE),
                'watch_seconds', COALESCE(lp.watch_seconds, 0),
                'last_accessed', lp.last_accessed
              ) ORDER BY l.sort_order
            ) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
     FROM course_modules m
     LEFT JOIN lessons l ON l.module_id = m.id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $2
     WHERE m.course_id = $1
     GROUP BY m.id
     ORDER BY m.sort_order`,
    [courseId, studentId]
  );

  const bookmarked = await queryOne<{ id: string }>(
    `SELECT id FROM student_learning_bookmarks
     WHERE user_id = $1 AND target_type = 'course' AND target_id = $2`,
    [studentId, courseId]
  ).catch(() => null);

  const certEligible = Boolean(enrollment && Number(enrollment.progress_percent) >= 100);

  return {
    ...course,
    objectives: course.description,
    skills_covered: course.tags || [],
    prerequisites: [] as string[],
    enrollment,
    progress_percent: enrollment ? Number(enrollment.progress_percent) : 0,
    modules,
    resources: flattenResources(modules),
    assignments: [] as unknown[],
    assessments: [] as unknown[],
    certificate_eligible: certEligible,
    bookmarked: Boolean(bookmarked),
  };
}

function flattenResources(
  modules: Array<{ title: string; lessons: unknown }>
): Array<{
  id: string;
  title: string;
  type: string;
  url: string | null;
  module_title: string;
}> {
  const out: Array<{
    id: string;
    title: string;
    type: string;
    url: string | null;
    module_title: string;
  }> = [];
  for (const m of modules) {
    const lessons = (Array.isArray(m.lessons) ? m.lessons : []) as Array<{
      id: string;
      title: string;
      content_type: string;
      content_url: string | null;
    }>;
    for (const l of lessons) {
      if (l.content_url || ["pdf", "document", "presentation", "link", "video"].includes(l.content_type)) {
        out.push({
          id: l.id,
          title: l.title,
          type: l.content_type || "resource",
          url: l.content_url,
          module_title: m.title,
        });
      }
    }
  }
  return out;
}

/** GET /learning/lessons/:id */
export async function getLesson(studentId: string, lessonId: string) {
  const lesson = await queryOne<{
    id: string;
    title: string;
    content_type: string;
    content_url: string | null;
    content_text: string | null;
    video_duration_seconds: number | null;
    sort_order: number;
    is_free_preview: boolean;
    estimated_minutes: number | null;
    module_id: string;
    module_title: string;
    course_id: string;
    course_title: string;
    watch_seconds: number;
    is_completed: boolean;
    last_accessed: string | null;
  }>(
    `SELECT l.id, l.title, l.content_type, l.content_url, l.content_text,
            l.video_duration_seconds, l.sort_order, l.is_free_preview, l.estimated_minutes,
            m.id AS module_id, m.title AS module_title,
            c.id AS course_id, c.title AS course_title,
            COALESCE(lp.watch_seconds, 0)::int AS watch_seconds,
            COALESCE(lp.is_completed, FALSE) AS is_completed,
            lp.last_accessed::text AS last_accessed
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $2
     WHERE l.id = $1`,
    [lessonId, studentId]
  );
  if (!lesson) throw new AppError("Lesson not found", 404);

  const enrolled = await queryOne(
    `SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2`,
    [studentId, lesson.course_id]
  );
  if (!enrolled && !lesson.is_free_preview) {
    throw new AppError("Enroll in this course to access the lesson", 403);
  }

  const siblings = await query<{ id: string; title: string; sort_order: number; module_order: number }>(
    `SELECT l.id, l.title, l.sort_order, m.sort_order AS module_order
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     WHERE m.course_id = $1
     ORDER BY m.sort_order, l.sort_order`,
    [lesson.course_id]
  );
  const idx = siblings.findIndex((s) => s.id === lessonId);

  const bookmarked = await queryOne(
    `SELECT id FROM student_learning_bookmarks
     WHERE user_id = $1 AND target_type = 'lesson' AND target_id = $2`,
    [studentId, lessonId]
  ).catch(() => null);

  return {
    ...lesson,
    previous_lesson_id: idx > 0 ? siblings[idx - 1].id : null,
    next_lesson_id: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null,
    bookmarked: Boolean(bookmarked),
  };
}

/**
 * POST /learning/lessons/:id/progress
 * Delegates to the same lesson_progress upsert rules as LMS (watch + complete).
 */
export async function saveLessonProgress(
  studentId: string,
  lessonId: string,
  body: { watch_seconds?: number; is_completed?: boolean; playback_position?: number }
) {
  const watch = Number(body.watch_seconds ?? body.playback_position ?? 0) || 0;
  const isCompleted = Boolean(body.is_completed);

  const lesson = await queryOne<{ course_id: string }>(
    `SELECT c.id AS course_id
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE l.id = $1`,
    [lessonId]
  );
  if (!lesson) throw new AppError("Lesson not found", 404);

  const progress = await queryOne(
    `INSERT INTO lesson_progress (student_id, lesson_id, watch_seconds, is_completed, completed_at, last_accessed)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (student_id, lesson_id) DO UPDATE SET
       watch_seconds = GREATEST(lesson_progress.watch_seconds, $3),
       is_completed  = CASE WHEN $4 THEN TRUE ELSE lesson_progress.is_completed END,
       completed_at  = CASE WHEN $4 AND lesson_progress.completed_at IS NULL THEN NOW() ELSE lesson_progress.completed_at END,
       last_accessed = NOW()
     RETURNING *`,
    [studentId, lessonId, watch, isCompleted, isCompleted ? new Date() : null]
  );

  // Recalculate enrollment progress (same formula as LMS route).
  await query(
    `UPDATE enrollments SET
       progress_percent = (
         SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE lp.is_completed) / NULLIF(COUNT(*), 0), 2)
         FROM lessons l
         JOIN course_modules m ON m.id = l.module_id
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
         WHERE m.course_id = $2
       ),
       status = CASE
         WHEN (
           SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE lp.is_completed) / NULLIF(COUNT(*), 0), 2)
           FROM lessons l
           JOIN course_modules m ON m.id = l.module_id
           LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
           WHERE m.course_id = $2
         ) >= 100 THEN 'completed'
         ELSE status
       END,
       completed_at = CASE
         WHEN (
           SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE lp.is_completed) / NULLIF(COUNT(*), 0), 2)
           FROM lessons l
           JOIN course_modules m ON m.id = l.module_id
           LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
           WHERE m.course_id = $2
         ) >= 100 AND completed_at IS NULL THEN NOW()
         ELSE completed_at
       END
     WHERE student_id = $1 AND course_id = $2`,
    [studentId, lesson.course_id]
  );

  return progress;
}

/** GET /learning/progress */
export async function getProgress(studentId: string) {
  const [summary, courses, timeline, streak] = await Promise.all([
    getSummary(studentId),
    listCourses(studentId, { scope: "assigned" }),
    query<{ day: string; lessons_completed: number; seconds: number }>(
      `SELECT DATE(completed_at)::text AS day,
              COUNT(*)::int AS lessons_completed,
              COALESCE(SUM(watch_seconds), 0)::int AS seconds
       FROM lesson_progress
       WHERE student_id = $1 AND is_completed = TRUE AND completed_at IS NOT NULL
       GROUP BY DATE(completed_at)
       ORDER BY day DESC
       LIMIT 30`,
      [studentId]
    ).catch(() => []),
    queryOne<{ days: number }>(
      `SELECT COUNT(DISTINCT DATE(last_accessed))::int AS days
       FROM lesson_progress
       WHERE student_id = $1 AND last_accessed >= NOW() - INTERVAL '14 days'`,
      [studentId]
    ).catch(() => ({ days: 0 })),
  ]);

  const lessonStats = await queryOne<{ completed: number; total: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE lp.is_completed)::int AS completed,
       COUNT(*)::int AS total
     FROM enrollments e
     JOIN course_modules m ON m.course_id = e.course_id
     JOIN lessons l ON l.module_id = m.id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = e.student_id
     WHERE e.student_id = $1`,
    [studentId]
  ).catch(() => ({ completed: 0, total: 0 }));

  return {
    overall: summary,
    courses: courses.map((c) => ({
      course_id: c.id,
      title: c.title,
      progress_percent: c.progress_percent,
      status: c.completion_status,
    })),
    lessons_completed: lessonStats?.completed ?? 0,
    lessons_total: lessonStats?.total ?? 0,
    time_spent_hours: summary.learning_hours,
    learning_streak_days: streak?.days ?? summary.learning_streak_days,
    completion_timeline: timeline,
  };
}

/** GET /learning/resources — flatten downloadable lesson assets from enrolled courses. */
export async function listResources(studentId: string) {
  const rows = await query<{
    id: string;
    title: string;
    content_type: string;
    content_url: string | null;
    course_id: string;
    course_title: string;
    module_title: string;
  }>(
    `SELECT l.id, l.title, l.content_type, l.content_url,
            c.id AS course_id, c.title AS course_title, m.title AS module_title
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN course_modules m ON m.course_id = c.id
     JOIN lessons l ON l.module_id = m.id
     WHERE e.student_id = $1
       AND (
         l.content_url IS NOT NULL
         OR l.content_type IN ('pdf','document','presentation','link','video','reading')
       )
     ORDER BY c.title, m.sort_order, l.sort_order`,
    [studentId]
  );
  return rows.map((r) => ({
    ...r,
    type: r.content_type,
    url: r.content_url,
    can_preview: Boolean(r.content_url) || r.content_type === "reading",
    can_download: Boolean(r.content_url),
  }));
}

/** GET /learning/assignments — no LMS assignment entity; return empty contract. */
export async function listAssignments(_studentId: string) {
  return [] as Array<{
    id: string;
    name: string;
    course_id: string;
    course_name: string;
    due_date: string | null;
    status: string;
    submission_status: string;
  }>;
}

/** GET /learning/assessments — adapt student assessment campaigns. */
export async function listAssessments(studentId: string) {
  const upcoming = await dashboard.getUpcomingAssessments(studentId, 50);
  return upcoming.map((a) => ({
    id: a.campaign_id,
    name: a.assessment_name,
    campaign_name: a.campaign_name,
    availability: a.status,
    attempts_remaining: a.attempts_remaining ?? null,
    status: a.raw_status,
    can_start: Boolean(a.can_start || a.can_resume),
    launch_href: `/app/student-portal/my-assessments/${a.campaign_id}/instructions`,
    result_href: `/app/student-portal/my-assessments/${a.campaign_id}/result`,
    available_from: a.scheduled_at ?? null,
    available_until: a.available_until ?? null,
  }));
}

/** GET /learning/certificates */
export async function listCertificates(studentId: string) {
  return query(
    `SELECT cert.id, cert.title, cert.issued_at::text AS issue_date,
            cert.id::text AS certificate_id,
            cert.course_id, c.title AS course_title
     FROM certificates cert
     LEFT JOIN courses c ON c.id = cert.course_id
     WHERE cert.student_id = $1
     ORDER BY cert.issued_at DESC NULLS LAST`,
    [studentId]
  );
}

/** Bookmarks */
export async function listBookmarks(studentId: string) {
  await ensureSchema();
  return query(
    `SELECT id, target_type, target_id, title, href, meta, created_at::text
     FROM student_learning_bookmarks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [studentId]
  );
}

export async function addBookmark(
  studentId: string,
  body: { target_type: string; target_id: string; title?: string; href?: string; meta?: Record<string, unknown> }
) {
  await ensureSchema();
  const type = String(body.target_type || "").toLowerCase();
  if (!["course", "lesson", "resource"].includes(type)) {
    throw new AppError("target_type must be course, lesson, or resource", 400);
  }
  const targetId = String(body.target_id || "").trim();
  if (!targetId) throw new AppError("target_id is required", 400);

  const row = await queryOne(
    `INSERT INTO student_learning_bookmarks (user_id, target_type, target_id, title, href, meta)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET
       title = COALESCE(EXCLUDED.title, student_learning_bookmarks.title),
       href = COALESCE(EXCLUDED.href, student_learning_bookmarks.href),
       meta = COALESCE(EXCLUDED.meta, student_learning_bookmarks.meta)
     RETURNING *`,
    [
      studentId,
      type,
      targetId,
      body.title || null,
      body.href || null,
      JSON.stringify(body.meta || {}),
    ]
  );
  return row;
}

export async function removeBookmark(studentId: string, id: string) {
  await ensureSchema();
  const row = await queryOne(
    `DELETE FROM student_learning_bookmarks WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, studentId]
  );
  if (!row) throw new AppError("Bookmark not found", 404);
  return { deleted: true };
}

/** GET /learning/recommendations */
export async function getRecommendations(studentId: string) {
  const [base, courses, weak] = await Promise.all([
    dashboard.getRecommendations(studentId),
    listCourses(studentId, { scope: "all" }).then((c) =>
      c.filter((x) => !x.is_assigned).slice(0, 3)
    ),
    dashboard.getSkills(studentId).catch(() => ({ weak_skills: [] as Array<{ name: string; proficiency: number }> })),
  ]);

  const learningRecs = base.map((r) => ({
    id: r.id,
    kind:
      r.type === "course"
        ? "course"
        : r.type === "assessment"
          ? "practice_assessment"
          : r.type === "practice"
            ? "skill_plan"
            : "suggestion",
    title: r.title,
    description: r.description,
    href: r.href.replace("/app/student-portal/learn", "/app/student-portal/my-learning"),
    priority: r.priority,
  }));

  for (const c of courses) {
    learningRecs.push({
      id: `rec-course-${c.id}`,
      kind: "course",
      title: `Recommended: ${c.title}`,
      description: `${c.category || "Course"} · ${c.difficulty || "beginner"}`,
      href: `/app/student-portal/my-learning/courses/${c.id}`,
      priority: 7,
    });
  }

  const weakSkill = weak.weak_skills?.[0];
  if (weakSkill) {
    learningRecs.push({
      id: `skill-plan-${weakSkill.name}`,
      kind: "skill_plan",
      title: `Improve ${weakSkill.name}`,
      description: `Skill at ${weakSkill.proficiency}%. Follow a focused practice plan.`,
      href: `/app/student-portal/adaptive-learning`,
      priority: 5,
    });
  }

  return learningRecs.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

/** GET /calendar/learning-events */
export async function getLearningEvents(studentId: string, days = 30) {
  const windowDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const [assessments, courses] = await Promise.all([
    dashboard.getUpcomingAssessments(studentId, 30),
    listCourses(studentId, { scope: "assigned" }),
  ]);

  type Ev = {
    id: string;
    title: string;
    type: "assessment" | "course_deadline" | "assignment" | "live_session";
    starts_at: string | null;
    ends_at: string | null;
    href: string;
  };

  const events: Ev[] = [];

  for (const a of assessments) {
    events.push({
      id: `assess-${a.campaign_id}`,
      title: a.assessment_name,
      type: "assessment",
      starts_at: a.scheduled_at || null,
      ends_at: a.available_until || null,
      href: `/app/student-portal/my-assessments/${a.campaign_id}/instructions`,
    });
  }

  for (const c of courses) {
    if (c.due_date) {
      events.push({
        id: `course-due-${c.id}`,
        title: `Due: ${c.title}`,
        type: "course_deadline",
        starts_at: c.due_date,
        ends_at: c.due_date,
        href: `/app/student-portal/my-learning/courses/${c.id}`,
      });
    }
  }

  // Filter to window loosely (backend may send null dates)
  const cutoff = Date.now() + windowDays * 86400000;
  return events
    .filter((e) => {
      if (!e.starts_at && !e.ends_at) return true;
      const t = new Date(e.starts_at || e.ends_at || 0).getTime();
      return Number.isNaN(t) || t <= cutoff;
    })
    .slice(0, 40);
}
