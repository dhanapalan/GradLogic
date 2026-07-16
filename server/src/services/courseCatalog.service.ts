/**
 * Course Catalog — discovery, publish surface, Placement Tracks centerpiece.
 * Reads LMS courses; does not assemble content (that is Course Builder).
 */
import { query, queryOne } from "../config/database.js";
import {
  getAssessmentConfig,
  listCourseAssets,
  type AssessmentConfig,
} from "./courseBuilder.service.js";

export const PLACEMENT_TRACKS = [
  {
    slug: "aptitude-preparation",
    title: "Aptitude Preparation",
    short_title: "Aptitude",
    description:
      "Quantitative aptitude for campus placements — numbers, percentages, DI, and speed math.",
    categories: ["aptitude"],
    domain_label: "Quantitative Aptitude",
    estimated_weeks: 4,
  },
  {
    slug: "logical-reasoning",
    title: "Logical Reasoning",
    short_title: "Reasoning",
    description: "Series, syllogisms, puzzles, and analytical reasoning for placement papers.",
    categories: ["reasoning"],
    domain_label: "Logical Reasoning",
    estimated_weeks: 4,
  },
  {
    slug: "python-placement",
    title: "Python Placement",
    short_title: "Python",
    description: "Python programming path from basics through OOP and placement coding drills.",
    categories: ["python_coding"],
    domain_label: "Python Programming",
    estimated_weeks: 6,
  },
  {
    slug: "java-placement",
    title: "Java Placement",
    short_title: "Java",
    description: "Java fundamentals, collections, and interview-ready coding practice.",
    categories: ["java_coding"],
    domain_label: "Java Programming",
    estimated_weeks: 6,
  },
  {
    slug: "ai-ml-foundations",
    title: "AI / ML Foundations",
    short_title: "AI & ML",
    description:
      "Artificial Intelligence fundamentals and Machine Learning basics for fresher readiness.",
    categories: ["data_science"],
    domain_label: "AI Fundamentals · ML Basics",
    estimated_weeks: 6,
  },
] as const;

export type PlacementTrackSlug = (typeof PLACEMENT_TRACKS)[number]["slug"];

export async function getCatalogDashboard() {
  const statusRows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM courses GROUP BY status`
  );
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of statusRows) {
    const n = Number(r.count) || 0;
    byStatus[r.status] = n;
    total += n;
  }

  const enrollRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM enrollments`
  );

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
    completionPercent = null;
  }

  const featured = await query<{
    id: string;
    title: string;
    category: string;
    difficulty: string;
    status: string;
    total_modules: number;
    enrollment_count: string;
    updated_at: string;
  }>(`
    SELECT c.id, c.title, c.category, c.difficulty, c.status, c.total_modules, c.updated_at,
      (SELECT COUNT(*)::text FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count
    FROM courses c
    WHERE c.status = 'published'
    ORDER BY (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) DESC, c.updated_at DESC
    LIMIT 6
  `);

  const recent = await query<{
    id: string;
    title: string;
    category: string;
    difficulty: string;
    status: string;
    published_at: string;
  }>(`
    SELECT id, title, category, difficulty, status, updated_at AS published_at
    FROM courses
    WHERE status = 'published'
    ORDER BY updated_at DESC
    LIMIT 6
  `);

  return {
    total,
    published: byStatus.published || 0,
    draft: byStatus.draft || 0,
    archived: byStatus.archived || 0,
    placementTracks: PLACEMENT_TRACKS.length,
    studentsEnrolled: Number(enrollRow?.total) || 0,
    averageCompletion: completionPercent,
    averageRating: null as number | null,
    featured: featured.map((c) => ({
      ...c,
      enrollments: Number(c.enrollment_count) || 0,
    })),
    recentlyPublished: recent,
  };
}

export async function listPlacementTracks() {
  const tracks = [];
  for (const t of PLACEMENT_TRACKS) {
    const stats = await queryOne<{
      published: string;
      draft: string;
      enrollments: string;
      modules: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'published')::text AS published,
         COUNT(*) FILTER (WHERE status = 'draft')::text AS draft,
         COALESCE(SUM((SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id)), 0)::text AS enrollments,
         COALESCE(SUM(total_modules), 0)::text AS modules
       FROM courses c
       WHERE c.category = ANY($1::text[])`,
      [t.categories as unknown as string[]]
    );

    tracks.push({
      ...t,
      published_courses: Number(stats?.published) || 0,
      draft_courses: Number(stats?.draft) || 0,
      enrollments: Number(stats?.enrollments) || 0,
      total_modules: Number(stats?.modules) || 0,
    });
  }
  return tracks;
}

export async function getPlacementTrack(slug: string) {
  const def = PLACEMENT_TRACKS.find((t) => t.slug === slug);
  if (!def) return null;

  const courses = await query<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    difficulty: string;
    status: string;
    duration_hours: number | null;
    total_modules: number;
    thumbnail_url: string | null;
    updated_at: string;
    instructor_name: string | null;
    enrollment_count: string;
    asset_count: string;
  }>(`
    SELECT c.id, c.title, c.description, c.category, c.difficulty, c.status,
      c.duration_hours, c.total_modules, c.thumbnail_url, c.updated_at,
      u.name AS instructor_name,
      (SELECT COUNT(*)::text FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count,
      (SELECT COUNT(*)::text FROM course_module_assets a
         JOIN course_modules m ON m.id = a.module_id WHERE m.course_id = c.id) AS asset_count
    FROM courses c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.category = ANY($1::text[])
      AND c.status IN ('published', 'draft')
    ORDER BY
      CASE c.status WHEN 'published' THEN 0 ELSE 1 END,
      c.updated_at DESC
  `, [def.categories as unknown as string[]]);

  return {
    ...def,
    courses: courses.map((c) => ({
      ...c,
      enrollments: Number(c.enrollment_count) || 0,
      mapped_assets: Number(c.asset_count) || 0,
    })),
  };
}

export async function listCatalogCourses(filters: {
  status?: string;
  category?: string;
  search?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(filters.limit ?? 48, 100);
  const offset = filters.offset ?? 0;
  const params: unknown[] = [];
  const where: string[] = ["1=1"];

  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`c.status = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`c.category = $${params.length}`);
  }
  if (filters.difficulty) {
    params.push(filters.difficulty);
    where.push(`c.difficulty = $${params.length}`);
  }
  if (filters.search?.trim()) {
    params.push(filters.search.trim());
    where.push(
      `(c.title ILIKE '%' || $${params.length} || '%' OR c.description ILIKE '%' || $${params.length} || '%' OR c.category ILIKE '%' || $${params.length} || '%' OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.tags, '{}')) t WHERE t ILIKE '%' || $${params.length} || '%'))`
    );
  }

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const rows = await query(`
    SELECT c.id, c.title, c.description, c.category, c.difficulty, c.status,
      c.duration_hours, c.total_modules, c.thumbnail_url, c.language, c.subject,
      c.tags, c.updated_at, c.created_at,
      u.name AS instructor_name,
      (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS enrollments,
      (SELECT COUNT(*)::int FROM course_module_assets a
         JOIN course_modules m ON m.id = a.module_id
         WHERE m.course_id = c.id AND a.role IN ('practice','coding')) AS practice_items,
      (SELECT COUNT(*)::int FROM course_module_assets a
         JOIN course_modules m ON m.id = a.module_id
         WHERE m.course_id = c.id AND a.role = 'coding') AS coding_items,
      (SELECT COUNT(*)::int FROM course_module_assets a
         JOIN course_modules m ON m.id = a.module_id
         WHERE m.course_id = c.id AND a.role = 'assessment') AS assessment_items,
      (SELECT COUNT(*)::int FROM course_modules m WHERE m.course_id = c.id) AS module_count
    FROM courses c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE ${where.join(" AND ")}
    ORDER BY c.updated_at DESC
    LIMIT $${limIdx} OFFSET $${offIdx}
  `, params);

  const countParams = params.slice(0, -2);
  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM courses c WHERE ${where.join(" AND ")}`,
    countParams
  );

  return {
    courses: rows,
    total: Number(countRow?.total) || 0,
    limit,
    offset,
  };
}

export type CatalogAssetRole =
  | "lesson"
  | "resource"
  | "practice"
  | "coding"
  | "assessment"
  | "voice"
  | string;

export interface CatalogPreviewAsset {
  id: string;
  module_id: string;
  role: CatalogAssetRole;
  asset_type: string;
  asset_id: string;
  asset_title: string | null;
  sort_order: number;
  meta: Record<string, unknown>;
}

export interface CatalogPreviewModule {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lesson_count: number;
  assets: CatalogPreviewAsset[];
  by_role: Record<string, CatalogPreviewAsset[]>;
}

export interface CatalogAssignmentRow {
  college_id: string;
  college_name: string;
  assigned_at: string;
  notes: string | null;
  meta: Record<string, unknown>;
  batch_id: string | null;
  batch_name: string | null;
}

export async function getCoursePreview(courseId: string) {
  const course = await queryOne<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    difficulty: string;
    status: string;
    duration_hours: number | null;
    total_modules: number;
    thumbnail_url: string | null;
    language: string | null;
    subject: string | null;
    tags: string[] | null;
    updated_at: string;
    created_at: string;
    instructor_name: string | null;
    enrollment_count: string;
  }>(
    `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.status,
        c.duration_hours, c.total_modules, c.thumbnail_url, c.language, c.subject,
        c.tags, c.updated_at, c.created_at,
        u.name AS instructor_name,
        (SELECT COUNT(*)::text FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count
     FROM courses c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = $1`,
    [courseId]
  );
  if (!course) return null;

  const moduleRows = await query<{
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    lesson_count: string;
  }>(
    `SELECT m.id, m.title, m.description, m.sort_order,
        (SELECT COUNT(*)::text FROM lessons l WHERE l.module_id = m.id) AS lesson_count
     FROM course_modules m
     WHERE m.course_id = $1
     ORDER BY m.sort_order`,
    [courseId]
  );

  const rawAssets = (await listCourseAssets(courseId)) as Array<{
    id: string;
    module_id: string;
    role: string;
    asset_type: string;
    asset_id: string;
    asset_title: string | null;
    sort_order: number;
    meta: Record<string, unknown> | null;
  }>;

  const assetsByModule = new Map<string, CatalogPreviewAsset[]>();
  const role_counts: Record<string, number> = {};

  for (const a of rawAssets) {
    const item: CatalogPreviewAsset = {
      id: a.id,
      module_id: a.module_id,
      role: a.role,
      asset_type: a.asset_type,
      asset_id: a.asset_id,
      asset_title: a.asset_title,
      sort_order: a.sort_order ?? 0,
      meta: a.meta || {},
    };
    role_counts[a.role] = (role_counts[a.role] || 0) + 1;
    const list = assetsByModule.get(a.module_id) || [];
    list.push(item);
    assetsByModule.set(a.module_id, list);
  }

  const modules: CatalogPreviewModule[] = moduleRows.map((m) => {
    const assets = assetsByModule.get(m.id) || [];
    const by_role: Record<string, CatalogPreviewAsset[]> = {};
    for (const a of assets) {
      if (!by_role[a.role]) by_role[a.role] = [];
      by_role[a.role].push(a);
    }
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      sort_order: m.sort_order,
      lesson_count: Number(m.lesson_count) || 0,
      assets,
      by_role,
    };
  });

  let assessment_config: AssessmentConfig;
  try {
    assessment_config = await getAssessmentConfig(courseId);
  } catch {
    assessment_config = {
      passing_percent: 60,
      attempts: 3,
      min_practice_per_module: 3,
      require_assessment: true,
    };
  }

  let colleges: CatalogAssignmentRow[] = [];
  try {
    colleges = await query<CatalogAssignmentRow>(
      `SELECT cca.college_id, col.name AS college_name, cca.assigned_at,
          cca.notes, COALESCE(cca.meta, '{}'::jsonb) AS meta,
          cca.batch_id, b.name AS batch_name
       FROM course_college_assignments cca
       JOIN colleges col ON col.id = cca.college_id
       LEFT JOIN college_batches b ON b.id = cca.batch_id
       WHERE cca.course_id = $1
       ORDER BY col.name`,
      [courseId]
    );
  } catch {
    const basic = await query<{
      college_id: string;
      college_name: string;
      assigned_at: string;
    }>(
      `SELECT cca.college_id, col.name AS college_name, cca.assigned_at
       FROM course_college_assignments cca
       JOIN colleges col ON col.id = cca.college_id
       WHERE cca.course_id = $1
       ORDER BY col.name`,
      [courseId]
    );
    colleges = basic.map((r) => ({
      ...r,
      notes: null,
      meta: {},
      batch_id: null,
      batch_name: null,
    }));
  }

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    difficulty: course.difficulty,
    status: course.status,
    duration_hours: course.duration_hours,
    total_modules: course.total_modules,
    thumbnail_url: course.thumbnail_url,
    language: course.language,
    subject: course.subject,
    tags: course.tags || [],
    updated_at: course.updated_at,
    created_at: course.created_at,
    instructor_name: course.instructor_name,
    enrollments: Number(course.enrollment_count) || 0,
    modules,
    role_counts,
    assessment_config,
    colleges,
    totals: {
      modules: modules.length,
      assets: rawAssets.length,
      lessons: modules.reduce((n, m) => n + m.lesson_count, 0),
      practice: role_counts.practice || 0,
      coding: role_counts.coding || 0,
      assessment: role_counts.assessment || 0,
      voice: role_counts.voice || 0,
    },
  };
}
