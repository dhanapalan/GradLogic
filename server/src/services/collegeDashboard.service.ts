/**
 * Phase 2 · Module 01 — College Dashboard
 * Aggregated, college-scoped KPIs / charts / activities / pending actions.
 * Role projection: college_admin (full), placement_cell (placement), instructor (academic).
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

export type CampusDashboardRole =
  | "college_admin"
  | "college"
  | "college_staff"
  | "placement_cell"
  | "instructor";

export interface DashboardFilters {
  academic_year?: string | null;
  department?: string | null;
  batch?: string | null;
  semester?: string | null;
}

export interface DashboardContext {
  collegeId: string;
  role: string;
  /** Forced department scope (HOD-like) from caller's profile */
  forcedDepartment?: string | null;
}

function normalizeRole(role: string | undefined): CampusDashboardRole {
  const r = (role || "").toLowerCase();
  if (r === "college") return "college";
  if (r === "college_staff") return "college_staff";
  if (r === "placement_cell") return "placement_cell";
  if (r === "instructor") return "instructor";
  return "college_admin";
}

function isPlacementOnly(role: CampusDashboardRole) {
  return role === "placement_cell";
}

function isAcademicOnly(role: CampusDashboardRole) {
  return role === "instructor";
}

function sanitizeFilter(v: unknown, max = 80): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.length > max) return null;
  if (!/^[a-zA-Z0-9 _.\-\/]+$/.test(s)) return null;
  return s;
}

/** Department proxy: specialization → degree → class_name */
function buildStudentFilterSql(
  collegeId: string,
  filters: DashboardFilters,
  forcedDepartment?: string | null
): { where: string; params: unknown[]; nextIdx: number } {
  const params: unknown[] = [collegeId];
  let idx = 2;
  const clauses = [`u.college_id = $1`, `LOWER(u.role::text) = 'student'`];

  const dept = forcedDepartment || filters.department;
  if (dept) {
    params.push(dept);
    clauses.push(
      `(COALESCE(NULLIF(TRIM(sd.specialization), ''), NULLIF(TRIM(sd.degree), ''), NULLIF(TRIM(sd.class_name), ''), 'General') ILIKE $${idx})`
    );
    idx++;
  }
  if (filters.batch) {
    params.push(filters.batch);
    clauses.push(
      `(sd.passing_year::text = $${idx} OR sd.class_name ILIKE $${idx} OR sd.section ILIKE $${idx})`
    );
    idx++;
  }
  if (filters.academic_year) {
    params.push(filters.academic_year);
    clauses.push(
      `(sd.passing_year::text = $${idx} OR sd.class_name ILIKE '%' || $${idx} || '%')`
    );
    idx++;
  }
  if (filters.semester) {
    params.push(filters.semester);
    clauses.push(`(sd.section ILIKE $${idx} OR sd.class_name ILIKE '%' || $${idx} || '%')`);
    idx++;
  }

  return { where: clauses.join(" AND "), params, nextIdx: idx };
}

function parseFilters(raw: Record<string, unknown>): DashboardFilters {
  return {
    academic_year: sanitizeFilter(raw.academic_year),
    department: sanitizeFilter(raw.department),
    batch: sanitizeFilter(raw.batch),
    semester: sanitizeFilter(raw.semester),
  };
}

async function resolveForcedDepartment(
  userId: string,
  role: CampusDashboardRole
): Promise<string | null> {
  if (role === "college_admin" || role === "college" || role === "placement_cell") {
    return null;
  }
  try {
    const row = await queryOne<{ department: string | null; specialization: string | null }>(
      `SELECT u.department,
              (SELECT sd.specialization FROM student_details sd WHERE sd.user_id = u.id LIMIT 1) AS specialization
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    return sanitizeFilter(row?.department || row?.specialization);
  } catch {
    return null;
  }
}

export async function getFilterOptions(collegeId: string) {
  const departments = await query<{ value: string }>(
    `SELECT DISTINCT COALESCE(
        NULLIF(TRIM(sd.specialization), ''),
        NULLIF(TRIM(sd.degree), ''),
        NULLIF(TRIM(sd.class_name), ''),
        'General'
      ) AS value
     FROM student_details sd
     JOIN users u ON u.id = sd.user_id
     WHERE u.college_id = $1 AND LOWER(u.role::text) = 'student'
     ORDER BY 1
     LIMIT 40`,
    [collegeId]
  ).catch(() => []);

  const batches = await query<{ value: string }>(
    `SELECT DISTINCT COALESCE(sd.passing_year::text, sd.class_name, 'All') AS value
     FROM student_details sd
     JOIN users u ON u.id = sd.user_id
     WHERE u.college_id = $1 AND LOWER(u.role::text) = 'student'
       AND (sd.passing_year IS NOT NULL OR sd.class_name IS NOT NULL)
     ORDER BY 1 DESC
     LIMIT 40`,
    [collegeId]
  ).catch(() => []);

  const semesters = await query<{ value: string }>(
    `SELECT DISTINCT sd.section AS value
     FROM student_details sd
     JOIN users u ON u.id = sd.user_id
     WHERE u.college_id = $1 AND LOWER(u.role::text) = 'student'
       AND sd.section IS NOT NULL AND TRIM(sd.section) <> ''
     ORDER BY 1
     LIMIT 40`,
    [collegeId]
  ).catch(() => []);

  const years = await query<{ value: string }>(
    `SELECT DISTINCT sd.passing_year::text AS value
     FROM student_details sd
     JOIN users u ON u.id = sd.user_id
     WHERE u.college_id = $1 AND sd.passing_year IS NOT NULL
     ORDER BY 1 DESC
     LIMIT 20`,
    [collegeId]
  ).catch(() => []);

  return {
    departments: departments.map((d) => d.value).filter(Boolean),
    batches: batches.map((d) => d.value).filter(Boolean),
    semesters: semesters.map((d) => d.value).filter(Boolean),
    academic_years: years.map((d) => d.value).filter(Boolean),
  };
}

export async function getDashboardSummary(
  ctx: DashboardContext,
  rawFilters: Record<string, unknown>
) {
  const role = normalizeRole(ctx.role);
  const filters = parseFilters(rawFilters);
  if (ctx.forcedDepartment) filters.department = ctx.forcedDepartment;

  const { where, params } = buildStudentFilterSql(
    ctx.collegeId,
    filters,
    ctx.forcedDepartment
  );

  const studentCounts = await queryOne<{
    total_students: string;
    active_students: string;
    eligible: string;
    placed: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_students,
       COUNT(*) FILTER (WHERE u.is_active = TRUE)::text AS active_students,
       COUNT(*) FILTER (WHERE COALESCE(sd.eligible_for_hiring, FALSE) = TRUE)::text AS eligible,
       COUNT(*) FILTER (
         WHERE sd.placement_status IN ('Offered', 'Joined', 'Accepted')
            OR COALESCE(sd.offer_released, FALSE) = TRUE
            OR COALESCE(sd.has_joined, FALSE) = TRUE
       )::text AS placed
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE ${where}`,
    params
  ).catch(() => null);

  let activeDrives = 0;
  let pendingAssessments = 0;
  let companiesVisiting = 0;
  let upcomingInterviews = 0;
  try {
    const drives = await queryOne<{ active: string; pending: string }>(
      `SELECT
         COUNT(DISTINCT d.id) FILTER (
           WHERE LOWER(d.status) IN ('active','live','ready','scheduled','pool_ready')
         )::text AS active,
         COUNT(DISTINCT d.id) FILTER (
           WHERE LOWER(d.status) IN ('active','live','ready','scheduled','pool_ready','pool_approved')
             AND EXISTS (
               SELECT 1 FROM drive_students ds
               JOIN users u ON u.id = ds.student_id
               WHERE ds.drive_id = d.id AND u.college_id = $1
                 AND ds.status IN ('assigned','registered','not_started')
             )
         )::text AS pending
       FROM assessment_drives d
       JOIN drive_assignments da ON da.drive_id = d.id
       WHERE da.college_id = $1`,
      [ctx.collegeId]
    );
    activeDrives = Number(drives?.active) || 0;
    pendingAssessments = Number(drives?.pending) || 0;
  } catch {
    /* optional */
  }

  try {
    const cos = await queryOne<{ n: string }>(
      `SELECT COUNT(DISTINCT NULLIF(TRIM(sd.placed_company), ''))::text AS n
       FROM student_details sd
       JOIN users u ON u.id = sd.user_id
       WHERE ${where}
         AND (sd.placement_status IN ('Offered','Joined','Shortlisted','Interviewed')
              OR sd.is_shortlisted = TRUE)`,
      params
    );
    companiesVisiting = Number(cos?.n) || 0;
  } catch {
    companiesVisiting = 0;
  }

  try {
    const iv = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM student_details sd
       JOIN users u ON u.id = sd.user_id
       WHERE ${where}
         AND (
           sd.interview_status IS NOT NULL AND TRIM(sd.interview_status) <> ''
           AND LOWER(sd.interview_status) NOT IN ('completed','cancelled','none')
         )`,
      params
    );
    upcomingInterviews = Number(iv?.n) || 0;
  } catch {
    upcomingInterviews = 0;
  }

  let learningCompletion = 0;
  let avgReadiness: number | null = null;
  try {
    const learn = await queryOne<{ pct: string | null; avg: string | null }>(
      `SELECT
         ROUND(AVG(COALESCE(sj.progress_percent, 0)), 1)::text AS pct,
         ROUND(AVG(sj.placement_readiness), 1)::text AS avg
       FROM student_journeys sj
       JOIN users u ON u.id = sj.student_id
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE ${where}
         AND sj.status IN ('in_progress','completed','paused')`,
      params
    );
    learningCompletion = learn?.pct != null ? Number(learn.pct) : 0;
    avgReadiness = learn?.avg != null ? Number(learn.avg) : null;
  } catch {
    /* journeys optional */
  }

  const total = Number(studentCounts?.total_students) || 0;
  const eligible = Number(studentCounts?.eligible) || 0;
  const placed = Number(studentCounts?.placed) || 0;

  const kpis = {
    total_students: total,
    active_students: Number(studentCounts?.active_students) || 0,
    placement_eligible: eligible,
    students_placed: placed,
    active_placement_drives: activeDrives,
    companies_visiting: companiesVisiting,
    upcoming_interviews: upcomingInterviews,
    pending_assessments: pendingAssessments,
    learning_completion_percent: learningCompletion,
    avg_placement_readiness: avgReadiness,
    // legacy fields for older clients
    active_drives: activeDrives,
    placed_students: placed,
    placement_conversion: total > 0 ? Math.round((placed / total) * 1000) / 10 : 0,
    avg_score: 0,
    avg_integrity: 0,
  };

  // avg score / integrity (best-effort)
  try {
    const scores = await queryOne<{ avg: string | null }>(
      `SELECT ROUND(AVG(ds.score), 1)::text AS avg
       FROM drive_students ds
       JOIN users u ON u.id = ds.student_id
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE ${where} AND ds.status = 'completed' AND ds.score IS NOT NULL`,
      params
    );
    kpis.avg_score = scores?.avg != null ? Number(scores.avg) : 0;
  } catch {
    /* optional */
  }

  const visibility = {
    placement_kpis: !isAcademicOnly(role),
    academic_kpis: !isPlacementOnly(role),
    full: !isPlacementOnly(role) && !isAcademicOnly(role),
  };

  return {
    role,
    filters_applied: filters,
    visibility,
    ...kpis,
  };
}

export async function getDashboardCharts(
  ctx: DashboardContext,
  rawFilters: Record<string, unknown>
) {
  const role = normalizeRole(ctx.role);
  const filters = parseFilters(rawFilters);
  if (ctx.forcedDepartment) filters.department = ctx.forcedDepartment;
  const { where, params } = buildStudentFilterSql(
    ctx.collegeId,
    filters,
    ctx.forcedDepartment
  );

  let deptPlacement: Array<{ label: string; value: number }> = [];
  if (!isAcademicOnly(role)) {
    deptPlacement = (
      await query<{ label: string; total: string; placed: string }>(
        `SELECT COALESCE(
            NULLIF(TRIM(sd.specialization), ''),
            NULLIF(TRIM(sd.degree), ''),
            NULLIF(TRIM(sd.class_name), ''),
            'General'
          ) AS label,
          COUNT(*)::text AS total,
          COUNT(*) FILTER (
            WHERE sd.placement_status IN ('Offered','Joined','Accepted')
               OR COALESCE(sd.has_joined, FALSE)
          )::text AS placed
         FROM users u
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${where}
         GROUP BY 1
         HAVING COUNT(*) > 0
         ORDER BY COUNT(*) DESC
         LIMIT 12`,
        params
      ).catch(() => [])
    ).map((r) => {
      const t = Number(r.total) || 0;
      const p = Number(r.placed) || 0;
      return {
        label: r.label,
        value: t > 0 ? Math.round((p / t) * 1000) / 10 : 0,
      };
    });
  }

  let placementTrend: Array<{ label: string; value: number }> = [];
  if (!isAcademicOnly(role)) {
    placementTrend = (
      await query<{ label: string; value: string }>(
        `SELECT to_char(date_trunc('month', COALESCE(sd.updated_at, u.updated_at)), 'Mon YY') AS label,
                COUNT(*)::text AS value
         FROM student_details sd
         JOIN users u ON u.id = sd.user_id
         WHERE ${where}
           AND (sd.placement_status IN ('Offered','Joined','Accepted') OR sd.offer_released = TRUE)
         GROUP BY 1
         ORDER BY MIN(COALESCE(sd.updated_at, u.updated_at))
         LIMIT 12`,
        params
      ).catch(() => [])
    ).map((r) => ({ label: r.label, value: Number(r.value) || 0 }));
  }

  let readinessDistribution: Array<{ label: string; value: number }> = [];
  try {
    readinessDistribution = (
      await query<{ label: string; value: string }>(
        `SELECT
           CASE
             WHEN sj.placement_readiness < 40 THEN '0-39'
             WHEN sj.placement_readiness < 60 THEN '40-59'
             WHEN sj.placement_readiness < 80 THEN '60-79'
             ELSE '80-100'
           END AS label,
           COUNT(*)::text AS value
         FROM student_journeys sj
         JOIN users u ON u.id = sj.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${where}
           AND sj.status IN ('in_progress','completed','paused')
         GROUP BY 1
         ORDER BY 1`,
        params
      ).catch(() => [])
    ).map((r) => ({ label: r.label, value: Number(r.value) || 0 }));
  } catch {
    readinessDistribution = [];
  }

  let assessmentCompletion: Array<{ label: string; value: number }> = [];
  if (!isPlacementOnly(role)) {
    try {
      const row = await queryOne<{
        assigned: string;
        completed: string;
        in_progress: string;
      }>(
        `SELECT
           COUNT(*)::text AS assigned,
           COUNT(*) FILTER (WHERE ds.status = 'completed')::text AS completed,
           COUNT(*) FILTER (WHERE ds.status = 'in_progress')::text AS in_progress
         FROM drive_students ds
         JOIN users u ON u.id = ds.student_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${where}`,
        params
      );
      assessmentCompletion = [
        { label: "Assigned", value: Number(row?.assigned) || 0 },
        { label: "In progress", value: Number(row?.in_progress) || 0 },
        { label: "Completed", value: Number(row?.completed) || 0 },
      ];
    } catch {
      assessmentCompletion = [];
    }
  }

  let learningProgress: Array<{ label: string; value: number }> = [];
  if (!isPlacementOnly(role)) {
    try {
      learningProgress = (
        await query<{ label: string; value: string }>(
          `SELECT
             CASE
               WHEN COALESCE(sj.progress_percent, 0) < 25 THEN '0-24%'
               WHEN sj.progress_percent < 50 THEN '25-49%'
               WHEN sj.progress_percent < 75 THEN '50-74%'
               ELSE '75-100%'
             END AS label,
             COUNT(*)::text AS value
           FROM student_journeys sj
           JOIN users u ON u.id = sj.student_id
           LEFT JOIN student_details sd ON sd.user_id = u.id
           WHERE ${where}
             AND sj.status IN ('in_progress','completed','paused')
           GROUP BY 1
           ORDER BY 1`,
          params
        ).catch(() => [])
      ).map((r) => ({ label: r.label, value: Number(r.value) || 0 }));
    } catch {
      learningProgress = [];
    }
  }

  let offerStats: Array<{ label: string; value: number }> = [];
  if (!isAcademicOnly(role)) {
    try {
      const o = await queryOne<{
        shortlisted: string;
        offered: string;
        accepted: string;
        joined: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE sd.is_shortlisted OR sd.placement_status IN ('Shortlisted','Interviewed'))::text AS shortlisted,
           COUNT(*) FILTER (WHERE sd.offer_released OR sd.placement_status IN ('Offered','Accepted','Joined'))::text AS offered,
           COUNT(*) FILTER (WHERE sd.offer_accepted OR sd.placement_status IN ('Accepted','Joined'))::text AS accepted,
           COUNT(*) FILTER (WHERE sd.has_joined OR sd.placement_status = 'Joined')::text AS joined
         FROM users u
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${where}`,
        params
      );
      offerStats = [
        { label: "Shortlisted", value: Number(o?.shortlisted) || 0 },
        { label: "Offered", value: Number(o?.offered) || 0 },
        { label: "Accepted", value: Number(o?.accepted) || 0 },
        { label: "Joined", value: Number(o?.joined) || 0 },
      ];
    } catch {
      offerStats = [];
    }
  }

  return {
    role,
    visibility: {
      department_placement: !isAcademicOnly(role),
      placement_trend: !isAcademicOnly(role),
      readiness_distribution: true,
      assessment_completion: !isPlacementOnly(role),
      learning_progress: !isPlacementOnly(role),
      offer_stats: !isAcademicOnly(role),
    },
    department_placement_percent: deptPlacement,
    placement_trend: placementTrend,
    readiness_distribution: readinessDistribution,
    assessment_completion: assessmentCompletion,
    learning_progress: learningProgress,
    offer_stats: offerStats,
  };
}

export async function getDashboardActivities(
  ctx: DashboardContext,
  rawFilters: Record<string, unknown>
) {
  const role = normalizeRole(ctx.role);
  const filters = parseFilters(rawFilters);
  if (ctx.forcedDepartment) filters.department = ctx.forcedDepartment;
  const { where, params } = buildStudentFilterSql(
    ctx.collegeId,
    filters,
    ctx.forcedDepartment
  );

  const recentStudents = await query<{
    id: string;
    name: string;
    email: string;
    created_at: string;
  }>(
    `SELECT u.id, u.name, u.email, u.created_at::text
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE ${where}
     ORDER BY u.created_at DESC NULLS LAST
     LIMIT 8`,
    params
  ).catch(() => []);

  let latestDrives: Array<{
    id: string;
    name: string;
    status: string;
    scheduled_start: string | null;
  }> = [];
  if (!isAcademicOnly(role)) {
    latestDrives = await query(
      `SELECT d.id, d.name, d.status, d.scheduled_start::text
       FROM assessment_drives d
       JOIN drive_assignments da ON da.drive_id = d.id
       WHERE da.college_id = $1
       ORDER BY d.updated_at DESC NULLS LAST
       LIMIT 8`,
      [ctx.collegeId]
    ).catch(() => []);
  }

  let recentResults: Array<{
    student_name: string;
    drive_name: string;
    score: number | null;
    completed_at: string | null;
  }> = [];
  if (!isPlacementOnly(role)) {
    recentResults = (
      await query<{
        student_name: string;
        drive_name: string;
        score: string | null;
        completed_at: string | null;
      }>(
        `SELECT u.name AS student_name, ad.name AS drive_name,
                ds.score::text, ds.completed_at::text
         FROM drive_students ds
         JOIN users u ON u.id = ds.student_id
         JOIN assessment_drives ad ON ad.id = ds.drive_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${where} AND ds.status = 'completed'
         ORDER BY ds.completed_at DESC NULLS LAST
         LIMIT 8`,
        params
      ).catch(() => [])
    ).map((r) => ({
      student_name: r.student_name,
      drive_name: r.drive_name,
      score: r.score != null ? Number(r.score) : null,
      completed_at: r.completed_at,
    }));
  }

  let latestOffers: Array<{
    student_name: string;
    company: string | null;
    package: number | null;
    status: string | null;
  }> = [];
  if (!isAcademicOnly(role)) {
    latestOffers = (
      await query<{
        student_name: string;
        company: string | null;
        package: string | null;
        status: string | null;
      }>(
        `SELECT u.name AS student_name, sd.placed_company AS company,
                sd.placement_package::text AS package, sd.placement_status AS status
         FROM student_details sd
         JOIN users u ON u.id = sd.user_id
         WHERE ${where}
           AND (sd.offer_released = TRUE OR sd.placement_status IN ('Offered','Accepted','Joined'))
         ORDER BY sd.updated_at DESC NULLS LAST
         LIMIT 8`,
        params
      ).catch(() => [])
    ).map((r) => ({
      student_name: r.student_name,
      company: r.company,
      package: r.package != null ? Number(r.package) : null,
      status: r.status,
    }));
  }

  let notifications: Array<{ id: string; title: string; created_at: string }> = [];
  try {
    notifications = await query(
      `SELECT id::text, COALESCE(title, body, 'Notification') AS title, created_at::text
       FROM notifications
       WHERE (college_id = $1 OR user_id IN (SELECT id FROM users WHERE college_id = $1))
       ORDER BY created_at DESC
       LIMIT 8`,
      [ctx.collegeId]
    );
  } catch {
    notifications = [];
  }

  return {
    role,
    recently_registered_students: recentStudents,
    latest_placement_drives: latestDrives,
    recent_assessment_results: recentResults,
    latest_offers: latestOffers,
    recent_notifications: notifications,
  };
}

export async function getPendingActions(
  ctx: DashboardContext,
  rawFilters: Record<string, unknown>
) {
  const role = normalizeRole(ctx.role);
  const filters = parseFilters(rawFilters);
  if (ctx.forcedDepartment) filters.department = ctx.forcedDepartment;
  const { where, params } = buildStudentFilterSql(
    ctx.collegeId,
    filters,
    ctx.forcedDepartment
  );

  const resumePending = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE ${where}
       AND (sd.resume_url IS NULL OR TRIM(sd.resume_url) = '')
       AND COALESCE(sd.eligible_for_hiring, FALSE) = TRUE`,
    params
  ).catch(() => ({ n: "0" }));

  const eligibilityPending = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE ${where}
       AND COALESCE(sd.eligible_for_hiring, FALSE) = FALSE
       AND u.is_active = TRUE`,
    params
  ).catch(() => ({ n: "0" }));

  let pendingAssessments = 0;
  if (!isPlacementOnly(role)) {
    const pa = await queryOne<{ n: string }>(
      `SELECT COUNT(DISTINCT ds.id)::text AS n
       FROM drive_students ds
       JOIN users u ON u.id = ds.student_id
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE ${where}
         AND ds.status IN ('assigned','registered','not_started')`,
      params
    ).catch(() => ({ n: "0" }));
    pendingAssessments = Number(pa?.n) || 0;
  }

  let upcomingInterviews = 0;
  if (!isAcademicOnly(role)) {
    const iv = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE ${where}
         AND sd.interview_status IS NOT NULL
         AND TRIM(sd.interview_status) <> ''
         AND LOWER(sd.interview_status) NOT IN ('completed','cancelled','none')`,
      params
    ).catch(() => ({ n: "0" }));
    upcomingInterviews = Number(iv?.n) || 0;
  }

  // Faculty approvals — profile incomplete students as proxy
  let facultyApprovals = 0;
  if (!isPlacementOnly(role)) {
    const fa = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE ${where}
         AND COALESCE(u.is_profile_complete, FALSE) = FALSE`,
      params
    ).catch(() => ({ n: "0" }));
    facultyApprovals = Number(fa?.n) || 0;
  }

  const items = [
    {
      id: "resume_approval",
      label: "Resume approval pending",
      count: Number(resumePending?.n) || 0,
      href: "/app/college-portal/students?filter=resume_missing",
      visible: !isAcademicOnly(role),
    },
    {
      id: "eligibility_verification",
      label: "Students pending eligibility verification",
      count: Number(eligibilityPending?.n) || 0,
      href: "/app/college-portal/students?filter=eligibility_pending",
      visible: !isAcademicOnly(role),
    },
    {
      id: "pending_assessments",
      label: "Pending assessments",
      count: pendingAssessments,
      href: "/app/college-portal/drives",
      visible: !isPlacementOnly(role),
    },
    {
      id: "upcoming_interviews",
      label: "Upcoming interviews",
      count: upcomingInterviews,
      href: "/app/college-portal/workflows",
      visible: !isAcademicOnly(role),
    },
    {
      id: "faculty_approvals",
      label: "Pending faculty approvals",
      count: facultyApprovals,
      href: "/app/college-portal/students?filter=profile_incomplete",
      visible: !isPlacementOnly(role),
    },
  ].filter((i) => i.visible);

  return { role, items };
}

export async function buildContext(
  userId: string,
  collegeId: string | null | undefined,
  role: string | undefined
): Promise<DashboardContext> {
  if (!collegeId) {
    throw new AppError("Access denied. No college associated with this user.", 403);
  }
  const r = normalizeRole(role);
  const forcedDepartment = await resolveForcedDepartment(userId, r);
  return { collegeId, role: r, forcedDepartment };
}

export { parseFilters };
