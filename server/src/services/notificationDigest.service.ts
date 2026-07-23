/**
 * EOD assessment-completion digest — students and faculty get a scheduled
 * summary of pending/completed assessments instead of having to log in and
 * check manually. Reuses the existing notification.service.ts (in-app) and
 * email.service.ts (email) infra; scheduling lives in
 * queues/notificationDigest.queue.ts + workers/notificationDigest.worker.ts.
 */
import { query } from "../config/database.js";
import { logger } from "../config/logger.js";
import { sendNotification } from "./notification.service.js";
import { sendEmail } from "./email.service.js";

interface StudentDigestRow {
  user_id: string;
  name: string;
  email: string;
  pending: number;
  completed: number;
}

interface FacultyDigestRow {
  user_id: string;
  name: string;
  email: string;
  department: string | null;
  pending: number;
  completed: number;
}

async function getStudentDigest(collegeId: string): Promise<StudentDigestRow[]> {
  return query<StudentDigestRow>(
    `SELECT
        u.id AS user_id,
        u.name,
        u.email,
        COUNT(*) FILTER (WHERE a.id IS NULL OR a.status <> 'submitted')::int AS pending,
        COUNT(*) FILTER (WHERE a.status = 'submitted')::int AS completed
     FROM users u
     JOIN college_campaign_students cs ON cs.user_id = u.id
     JOIN college_assessment_campaigns c ON c.id = cs.campaign_id AND c.college_id = u.college_id
     LEFT JOIN college_campaign_attempts a ON a.campaign_id = cs.campaign_id AND a.user_id = u.id
     WHERE u.college_id = $1
       AND u.role = 'student'
       AND u.deleted_at IS NULL
       AND c.status = 'published'
     GROUP BY u.id, u.name, u.email
     HAVING COUNT(*) FILTER (WHERE a.id IS NULL OR a.status <> 'submitted') > 0`,
    [collegeId]
  );
}

async function getFacultyDigest(collegeId: string): Promise<FacultyDigestRow[]> {
  const faculty = await query<{ user_id: string; name: string; email: string; department: string | null }>(
    `SELECT id AS user_id, name, email, department
     FROM users
     WHERE college_id = $1 AND role = 'instructor' AND deleted_at IS NULL AND is_active = TRUE`,
    [collegeId]
  );

  const results: FacultyDigestRow[] = [];
  for (const f of faculty) {
    if (!f.department) continue;
    const row = await query<{ pending: number; completed: number }>(
      `SELECT
          COUNT(*) FILTER (WHERE a.id IS NULL OR a.status <> 'submitted')::int AS pending,
          COUNT(*) FILTER (WHERE a.status = 'submitted')::int AS completed
       FROM users u
       JOIN student_details sd ON sd.user_id = u.id
       JOIN college_campaign_students cs ON cs.user_id = u.id
       JOIN college_assessment_campaigns c ON c.id = cs.campaign_id AND c.college_id = u.college_id
       LEFT JOIN college_campaign_attempts a ON a.campaign_id = cs.campaign_id AND a.user_id = u.id
       WHERE u.college_id = $1
         AND u.role = 'student'
         AND u.deleted_at IS NULL
         AND c.status = 'published'
         AND sd.specialization = $2`,
      [collegeId, f.department]
    );
    results.push({ ...f, pending: row[0]?.pending ?? 0, completed: row[0]?.completed ?? 0 });
  }
  return results;
}

async function notifyStudent(row: StudentDigestRow) {
  const title = "Assessment reminder";
  const message = `You have ${row.pending} pending assessment${row.pending === 1 ? "" : "s"} (${row.completed} completed so far). Log in to complete them.`;
  await sendNotification(row.user_id, title, message, "warning");
  if (row.email) {
    await sendEmail({
      to: row.email,
      subject: "[GradLogic] You have pending assessments",
      text: message,
      recipientId: row.user_id,
      template: "assessment-digest-student",
    }).catch((err) => logger.error("[NotificationDigest] student email failed", err));
  }
}

async function notifyFaculty(row: FacultyDigestRow) {
  const title = "Department assessment summary";
  const message =
    row.pending > 0
      ? `${row.department}: ${row.pending} pending, ${row.completed} completed across your department.`
      : `${row.department}: all students have completed their assigned assessments. ${row.completed} completed.`;
  await sendNotification(row.user_id, title, message, row.pending > 0 ? "warning" : "success");
  if (row.email) {
    await sendEmail({
      to: row.email,
      subject: `[GradLogic] Daily summary — ${row.department}`,
      text: message,
      recipientId: row.user_id,
      template: "assessment-digest-faculty",
    }).catch((err) => logger.error("[NotificationDigest] faculty email failed", err));
  }
}

export async function runDailyDigestForCollege(collegeId: string): Promise<{
  studentsNotified: number;
  facultyNotified: number;
}> {
  let studentsNotified = 0;
  let facultyNotified = 0;

  try {
    const students = await getStudentDigest(collegeId);
    for (const s of students) {
      await notifyStudent(s);
      studentsNotified++;
    }
  } catch (err) {
    logger.error(`[NotificationDigest] student digest failed for college ${collegeId}`, err);
  }

  try {
    const faculty = await getFacultyDigest(collegeId);
    for (const f of faculty) {
      await notifyFaculty(f);
      facultyNotified++;
    }
  } catch (err) {
    logger.error(`[NotificationDigest] faculty digest failed for college ${collegeId}`, err);
  }

  return { studentsNotified, facultyNotified };
}

export async function runDailyDigestForAllColleges(): Promise<void> {
  const colleges = await query<{ id: string }>(
    `SELECT id FROM colleges WHERE deleted_at IS NULL`
  );
  for (const c of colleges) {
    const result = await runDailyDigestForCollege(c.id);
    logger.info(
      `[NotificationDigest] college ${c.id}: ${result.studentsNotified} students, ${result.facultyNotified} faculty notified`
    );
  }
}
