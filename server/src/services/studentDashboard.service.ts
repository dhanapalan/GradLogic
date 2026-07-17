/**
 * Student Portal Module 02 — Dashboard facade.
 * Thin adapters over existing assessment, learning, gamification, and profile
 * services. No duplicated scoring / eligibility business logic.
 */
import { query, queryOne } from "../config/database.js";
import * as workspace from "./studentAssessmentWorkspace.service.js";
import * as examSession from "./examSession.service.js";
import * as profile from "./studentPortalProfile.service.js";
import * as notificationService from "./notification.service.js";
import { ensureEvaluationSchema } from "./collegeCampaignEvaluation.service.js";

export const DEFAULT_WIDGETS = [
  "welcome",
  "readiness",
  "upcoming_assessments",
  "recent_results",
  "assigned_learning",
  "skill_progress",
  "ai_recommendations",
  "campus_drives",
  "notifications",
  "achievements",
  "calendar",
  "quick_actions",
] as const;

export type DashboardWidgetId = (typeof DEFAULT_WIDGETS)[number];

function readinessLevel(score: number): "Excellent" | "Good" | "Average" | "Needs Improvement" {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

function displayAssessmentStatus(
  status: workspace.MyAssessmentStatus
): "Upcoming" | "Live" | "Missed" | "In Progress" | "Completed" {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "available":
    case "in_progress":
      return status === "in_progress" ? "In Progress" : "Live";
    case "expired":
      return "Missed";
    case "submitted":
      return "Completed";
    default:
      return "Upcoming";
  }
}

/** GET /dashboard/student — shell: profile snapshot + widget visibility. */
export async function getDashboardShell(studentId: string) {
  const [me, completion] = await Promise.all([
    profile.getStudentMe(studentId),
    profile.getProfileCompletion(studentId),
  ]);

  return {
    student: {
      id: me.id,
      name: me.name,
      first_name: me.first_name,
      email: me.email,
      profile_photo_url: me.profile_photo_url ?? null,
      degree: me.degree ?? null,
      specialization: me.specialization ?? null,
      class_name: (me as { class_name?: string | null }).class_name ?? null,
      section: (me as { section?: string | null }).section ?? null,
      passing_year: me.passing_year ?? null,
      college_name: me.college_name ?? null,
      student_identifier: me.student_identifier ?? null,
    },
    profile_completion: {
      percentage: completion.percentage,
      is_profile_complete: completion.is_profile_complete,
      missing: completion.missing,
    },
    widgets: DEFAULT_WIDGETS.map((id) => ({ id, visible: true })),
  };
}

/** GET /assessments/upcoming */
export async function getUpcomingAssessments(studentId: string, limit = 8) {
  const [upcoming, available, inProgress] = await Promise.all([
    workspace.listMyAssessments(studentId, { status: "upcoming", limit, page: 1 }),
    workspace.listMyAssessments(studentId, { status: "available", limit, page: 1 }),
    workspace.listMyAssessments(studentId, { status: "in_progress", limit, page: 1 }),
  ]);

  const merged = [...inProgress.data, ...available.data, ...upcoming.data]
    .slice(0, limit)
    .map((a) => ({
      campaign_id: a.campaign_id,
      assessment_id: a.assessment_id,
      assessment_name: a.assessment_name,
      campaign_name: a.campaign_name,
      subject: a.assessment_type,
      scheduled_at: a.available_from,
      available_until: a.available_until,
      duration_minutes: a.duration_minutes,
      attempts_remaining: Math.max(0, a.max_attempts - a.attempts_used),
      max_attempts: a.max_attempts,
      status: displayAssessmentStatus(a.status),
      raw_status: a.status,
      can_start: a.can_start,
      can_resume: a.can_resume,
      action: a.action,
      start_blocked_reason: a.start_blocked_reason ?? null,
    }));

  return merged;
}

/** GET /assessments/recent-results — published evaluations only. */
export async function getRecentResults(studentId: string, limit = 8) {
  await ensureEvaluationSchema();
  const rows = await query<{
    campaign_id: string;
    assessment_id: string;
    assessment_name: string;
    campaign_name: string;
    obtained_marks: number;
    total_marks: number;
    percentage: number;
    passed: boolean | null;
    published_at: string | null;
    submitted_at: string | null;
    attempt_number: number | null;
  }>(
    `SELECT
       e.campaign_id,
       c.assessment_id,
       a.name AS assessment_name,
       c.name AS campaign_name,
       e.obtained_marks::float AS obtained_marks,
       e.total_marks::float AS total_marks,
       e.percentage::float AS percentage,
       e.passed,
       e.published_at::text AS published_at,
       att.submitted_at::text AS submitted_at,
       att.attempt_number
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN college_assessments a ON a.id = c.assessment_id
     LEFT JOIN college_campaign_attempts att ON att.id = e.attempt_id
     WHERE e.user_id = $1
       AND e.status = 'published'
     ORDER BY COALESCE(e.published_at, e.evaluated_at) DESC NULLS LAST
     LIMIT $2`,
    [studentId, limit]
  );

  return rows.map((r) => ({
    campaign_id: r.campaign_id,
    assessment_id: r.assessment_id,
    assessment_name: r.assessment_name,
    campaign_name: r.campaign_name,
    score: r.obtained_marks,
    total_marks: r.total_marks,
    percentage: Math.round(Number(r.percentage) || 0),
    rank: null as number | null,
    passed: r.passed,
    completed_at: r.submitted_at || r.published_at,
  }));
}

/** GET /learning/assigned */
export async function getAssignedLearning(studentId: string) {
  const rows = await query<{
    enrollment_id: string;
    program_id: string;
    enrolled_at: string;
    completed_at: string | null;
    status: string;
    program_name: string;
    program_description: string | null;
    program_type: string;
    duration_days: number | null;
    total_modules: number;
    completed_modules: number;
    avg_score: number | null;
  }>(
    `SELECT
       spe.id AS enrollment_id,
       spe.program_id,
       spe.enrolled_at::text AS enrolled_at,
       spe.completed_at::text AS completed_at,
       spe.status,
       sp.name AS program_name,
       sp.description AS program_description,
       sp.program_type,
       sp.duration_days,
       COUNT(DISTINCT pm.module_id)::int AS total_modules,
       COUNT(DISTINCT smp.module_id) FILTER (WHERE smp.status = 'completed')::int AS completed_modules,
       ROUND(AVG(smp.score) FILTER (WHERE smp.score IS NOT NULL))::int AS avg_score
     FROM student_program_enrollments spe
     JOIN skill_programs sp ON sp.id = spe.program_id
     LEFT JOIN program_modules pm ON pm.program_id = sp.id
     LEFT JOIN student_module_progress smp
       ON smp.enrollment_id = spe.id AND smp.module_id = pm.module_id
     WHERE spe.student_id = $1
     GROUP BY spe.id, sp.id
     ORDER BY spe.enrolled_at DESC`,
    [studentId]
  );

  return rows.map((r) => {
    const total = r.total_modules || 0;
    const done = r.completed_modules || 0;
    const completion_percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      ...r,
      completion_percentage,
      due_at: null as string | null,
      in_progress: r.status !== "completed" && done > 0,
    };
  });
}

/** GET /analytics/readiness — same Learn→Practice→Test→Certify composite as Workflow. */
export async function getReadiness(studentId: string) {
  const [enrollments, practice, drives, certs, prior] = await Promise.all([
    query<{ status: string; total_modules: number; completed_modules: number }>(
      `SELECT spe.status,
              COUNT(DISTINCT pm.module_id)::int AS total_modules,
              COUNT(DISTINCT smp.module_id) FILTER (WHERE smp.status = 'completed')::int AS completed_modules
       FROM student_program_enrollments spe
       JOIN skill_programs sp ON sp.id = spe.program_id
       LEFT JOIN program_modules pm ON pm.program_id = sp.id
       LEFT JOIN student_module_progress smp
         ON smp.enrollment_id = spe.id AND smp.module_id = pm.module_id
       WHERE spe.student_id = $1
       GROUP BY spe.id`,
      [studentId]
    ),
    queryOne<{ completed_sessions: number; avg_score: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_sessions,
              COALESCE(AVG(score_percent) FILTER (WHERE status = 'completed'), 0)::float AS avg_score
       FROM practice_sessions WHERE student_id = $1`,
      [studentId]
    ),
    examSession.getStudentDrives(studentId),
    query<{ id: string }>(
      `SELECT id FROM certificates WHERE student_id = $1 LIMIT 50`,
      [studentId]
    ).catch(() => [] as { id: string }[]),
    queryOne<{ pct: number }>(
      `SELECT ROUND(AVG(percentage))::int AS pct
       FROM college_campaign_evaluations
       WHERE user_id = $1 AND status = 'published'
         AND published_at < NOW() - INTERVAL '14 days'`,
      [studentId]
    ).catch(() => null),
  ]);

  const totalModules = enrollments.reduce((s, e) => s + (e.total_modules || 0), 0);
  const doneModules = enrollments.reduce((s, e) => s + (e.completed_modules || 0), 0);
  const learnPct = totalModules > 0 ? Math.round((doneModules / totalModules) * 100) : 0;

  const practiceDoneCount = practice?.completed_sessions ?? 0;
  const practicePct = Math.min(100, Math.round((practiceDoneCount / 3) * 100));

  const completedDrives = drives.filter((d) => d.session_status === "completed");
  const testPct = completedDrives.length >= 1 ? 100 : 0;

  const certifyPct = certs.length >= 1 ? 100 : 0;

  const score = Math.round((learnPct + practicePct + testPct + certifyPct) / 4);
  const previous = prior?.pct ?? null;
  const trend =
    previous == null ? null : score === previous ? 0 : score > previous ? score - previous : score - previous;

  return {
    score,
    level: readinessLevel(score),
    trend,
    previous_score: previous,
    stages: {
      learn: learnPct,
      practice: practicePct,
      test: testPct,
      certify: certifyPct,
    },
  };
}

/** GET /analytics/skills */
export async function getSkills(studentId: string) {
  const [skills, practiceScores] = await Promise.all([
    query<{
      skill_name: string;
      proficiency_score: number;
      assessment_source: string | null;
      last_assessed: string | null;
    }>(
      `SELECT skill_name, proficiency_score::float AS proficiency_score,
              assessment_source, last_assessed::text AS last_assessed
       FROM skill_progress
       WHERE student_id = $1
       ORDER BY proficiency_score DESC`,
      [studentId]
    ),
    query<{ skill_name: string; avg_score: number; sessions: number }>(
      `SELECT topic AS skill_name,
              ROUND(AVG(score_percent), 1)::float AS avg_score,
              COUNT(*)::int AS sessions
       FROM practice_sessions
       WHERE student_id = $1 AND status = 'completed' AND topic IS NOT NULL
       GROUP BY topic
       ORDER BY avg_score ASC`,
      [studentId]
    ),
  ]);

  // Prefer skill_progress; fall back to practice topic averages.
  const normalized =
    skills.length > 0
      ? skills.map((s) => ({
          name: s.skill_name,
          proficiency: Math.round(Number(s.proficiency_score) || 0),
          source: s.assessment_source,
        }))
      : practiceScores.map((s) => ({
          name: s.skill_name,
          proficiency: Math.round(Number(s.avg_score) || 0),
          source: "practice" as string | null,
        }));

  const top = [...normalized].sort((a, b) => b.proficiency - a.proficiency).slice(0, 6);
  // Only surface skills that are actually below the target threshold.
  const weak = [...normalized]
    .filter((s) => s.proficiency < 60)
    .sort((a, b) => a.proficiency - b.proficiency)
    .slice(0, 4);

  return {
    top_skills: top,
    weak_skills: weak,
    recommended_improvements: weak.slice(0, 3).map((w) => ({
      skill: w.name,
      message: `Focus practice on ${w.name} to raise proficiency above 60% (currently ${w.proficiency}%).`,
    })),
  };
}

/** GET /recommendations — rule-based tips from existing signals (not a new AI engine). */
export async function getRecommendations(studentId: string) {
  const [completion, readiness, learning, upcoming, skills] = await Promise.all([
    profile.getProfileCompletion(studentId),
    getReadiness(studentId),
    getAssignedLearning(studentId),
    getUpcomingAssessments(studentId, 3),
    getSkills(studentId),
  ]);

  type Rec = {
    id: string;
    type: "course" | "assessment" | "resume" | "interview" | "profile" | "practice";
    title: string;
    description: string;
    href: string;
    priority: number;
  };

  const recs: Rec[] = [];

  if (!completion.is_profile_complete || completion.percentage < 80) {
    recs.push({
      id: "complete-profile",
      type: "profile",
      title: "Complete your profile",
      description: `Your profile is ${completion.percentage}% complete. Finish it to unlock placement features.`,
      href: "/app/student-portal/profile",
      priority: 1,
    });
  }
  if (completion.missing.includes("resume_url")) {
    recs.push({
      id: "resume-update",
      type: "resume",
      title: "Upload or update your resume",
      description: "A current resume helps placement readiness and campus drive applications.",
      href: "/app/student-portal/profile",
      priority: 2,
    });
  }
  if (readiness.score < 70) {
    recs.push({
      id: "raise-readiness",
      type: "practice",
      title: "Boost placement readiness",
      description: `Current readiness is ${readiness.score}% (${readiness.level}). Continue Learn → Practice → Test.`,
      href: "/app/student-portal/workflow",
      priority: 3,
    });
  }
  const inProgress = learning.find((l) => l.status !== "completed");
  if (inProgress) {
    recs.push({
      id: `continue-${inProgress.program_id}`,
      type: "course",
      title: `Continue: ${inProgress.program_name}`,
      description: `${inProgress.completion_percentage}% complete · ${inProgress.completed_modules}/${inProgress.total_modules} modules`,
      href: "/app/student-portal/my-learning",
      priority: 4,
    });
  }
  const live = upcoming.find((a) => a.raw_status === "available" || a.raw_status === "in_progress");
  if (live) {
    recs.push({
      id: `assess-${live.campaign_id}`,
      type: "assessment",
      title: live.can_resume ? `Resume: ${live.assessment_name}` : `Start: ${live.assessment_name}`,
      description: `${live.campaign_name} · ${live.status}`,
      href: `/app/student-portal/my-assessments/${live.campaign_id}/instructions`,
      priority: 2,
    });
  }
  if (skills.weak_skills[0] && skills.weak_skills[0].proficiency < 60) {
    recs.push({
      id: `skill-${skills.weak_skills[0].name}`,
      type: "practice",
      title: `Practice ${skills.weak_skills[0].name}`,
      description: `This skill is below target (${skills.weak_skills[0].proficiency}%). A short practice session will help.`,
      href: `/app/student-portal/practice?topic=${encodeURIComponent(skills.weak_skills[0].name)}`,
      priority: 5,
    });
  }
  if (readiness.stages.test < 100) {
    recs.push({
      id: "mock-interview",
      type: "interview",
      title: "Try a mock interview",
      description: "Build confidence with an AI mock interview before campus drives.",
      href: "/app/student-portal/mock-interview",
      priority: 6,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

/**
 * GET /campus-drives/eligible
 * Student-visible drives from existing exam-session adapters (assigned + enrollable).
 */
export async function getEligibleCampusDrives(studentId: string) {
  const [mine, available] = await Promise.all([
    examSession.getStudentDrives(studentId),
    examSession.getAvailableSelfServiceDrives(studentId),
  ]);

  const assigned = mine
    .filter((d) => ["assigned", "registered", "in_progress"].includes(d.session_status))
    .map((d) => ({
      drive_id: d.drive_id,
      company: d.drive_name,
      role: d.drive_type.replace(/_/g, " "),
      registration_deadline: d.scheduled_end,
      drive_date: d.scheduled_start,
      status: d.session_status,
      can_apply: false,
      can_start: ["assigned", "registered", "in_progress"].includes(d.session_status),
      source: "assigned" as const,
    }));

  const enrollable = available.map((d) => ({
    drive_id: d.drive_id,
    company: d.drive_name,
    role: (d.placement_domain || d.phase1_domain || d.drive_type).replace(/_/g, " "),
    registration_deadline: null as string | null,
    drive_date: null as string | null,
    status: "open",
    can_apply: true,
    can_start: false,
    source: "eligible" as const,
  }));

  return [...assigned, ...enrollable].slice(0, 12);
}

/** GET /achievements */
export async function getAchievements(studentId: string) {
  const [badges, streak, certs, milestones] = await Promise.all([
    query<{
      slug: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      awarded_at: string;
    }>(
      `SELECT bd.slug, bd.name, bd.description, bd.icon, bd.category, sb.awarded_at::text AS awarded_at
       FROM student_badges sb
       JOIN badge_definitions bd ON bd.id = sb.badge_id
       WHERE sb.student_id = $1
       ORDER BY sb.awarded_at DESC
       LIMIT 12`,
      [studentId]
    ).catch(() => []),
    queryOne<{ current_streak: number; longest_streak: number }>(
      `SELECT current_streak, longest_streak FROM practice_streaks WHERE student_id = $1`,
      [studentId]
    ).catch(() => null),
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM certificates WHERE student_id = $1`,
      [studentId]
    ).catch(() => ({ n: 0 })),
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n
       FROM college_campaign_evaluations
       WHERE user_id = $1 AND status = 'published' AND COALESCE(passed, FALSE) = TRUE`,
      [studentId]
    ).catch(() => ({ n: 0 })),
  ]);

  return {
    badges,
    certificates_count: certs?.n ?? 0,
    assessment_milestones: milestones?.n ?? 0,
    streaks: {
      current: streak?.current_streak ?? 0,
      longest: streak?.longest_streak ?? 0,
    },
  };
}

/** GET /calendar/events — compose from assessments + drives (no new calendar store). */
export async function getCalendarEvents(studentId: string, days = 30) {
  const [upcoming, drives] = await Promise.all([
    getUpcomingAssessments(studentId, 20),
    examSession.getStudentDrives(studentId),
  ]);

  const events: Array<{
    id: string;
    title: string;
    type: "assessment" | "learning" | "placement" | "holiday";
    starts_at: string;
    ends_at?: string | null;
    href?: string;
  }> = [];

  for (const a of upcoming) {
    if (a.scheduled_at) {
      events.push({
        id: `assess-${a.campaign_id}`,
        title: a.assessment_name,
        type: "assessment",
        starts_at: a.scheduled_at,
        ends_at: a.available_until,
        href: `/app/student-portal/my-assessments/${a.campaign_id}/instructions`,
      });
    }
  }

  for (const d of drives) {
    if (d.scheduled_start && ["assigned", "registered", "in_progress"].includes(d.session_status)) {
      events.push({
        id: `drive-${d.drive_id}`,
        title: d.drive_name,
        type: "placement",
        starts_at: new Date(d.scheduled_start).toISOString(),
        ends_at: d.scheduled_end ? new Date(d.scheduled_end).toISOString() : null,
        href: `/app/student-portal/tests`,
      });
    }
  }

  const horizon = Date.now() + days * 24 * 60 * 60 * 1000;
  return events
    .filter((e) => {
      const t = new Date(e.starts_at).getTime();
      return !Number.isNaN(t) && t <= horizon;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 20);
}

/** Re-export notifications via existing service for dashboard widget. */
export async function getDashboardNotifications(studentId: string, limit = 8) {
  return notificationService.getUserNotifications(studentId, false, limit);
}
