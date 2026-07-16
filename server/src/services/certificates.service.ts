/**
 * Assessment Hub — Certificates
 * Issue Practice / Course / Placement Track completion certificates + simple PDF.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { buildSimpleCertificatePdf } from "../utils/simpleCertificatePdf.js";

export const CERT_TYPES = [
  "practice_completion",
  "course_completion",
  "placement_track_completion",
] as const;

export type CertType = (typeof CERT_TYPES)[number];

const KIND_LABEL: Record<CertType, string> = {
  practice_completion: "Practice Completion",
  course_completion: "Course Completion",
  placement_track_completion: "Placement Track Completion",
};

export interface CertificateRecord {
  id: string;
  student_id: string;
  course_id: string | null;
  path_id: string | null;
  drive_id: string | null;
  journey_id: string | null;
  cert_type: CertType;
  title: string | null;
  verification_code: string;
  issued_at: string;
  student_name?: string;
  student_email?: string;
  course_title?: string | null;
  path_title?: string | null;
  drive_name?: string | null;
}

function kindLabel(t: string): string {
  return KIND_LABEL[t as CertType] || t.replace(/_/g, " ");
}

export async function listCertificates(filters?: {
  search?: string;
  certType?: string;
  limit?: number;
}): Promise<CertificateRecord[]> {
  const limit = Math.min(filters?.limit ?? 200, 500);
  const params: unknown[] = [];
  const where = ["1=1"];

  if (filters?.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(
      `(u.name ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(cert.title, c.title, lp.title, ad.name, '') ILIKE $${params.length})`
    );
  }
  if (filters?.certType && CERT_TYPES.includes(filters.certType as CertType)) {
    params.push(filters.certType);
    where.push(`cert.cert_type = $${params.length}`);
  }

  params.push(limit);
  return query(
    `SELECT cert.*,
            COALESCE(u.full_name, u.name) AS student_name,
            u.email AS student_email,
            c.title AS course_title,
            lp.title AS path_title,
            ad.name AS drive_name
     FROM certificates cert
     JOIN users u ON u.id = cert.student_id
     LEFT JOIN courses c ON c.id = cert.course_id
     LEFT JOIN learning_paths lp ON lp.id = cert.path_id
     LEFT JOIN assessment_drives ad ON ad.id = cert.drive_id
     WHERE ${where.join(" AND ")}
     ORDER BY cert.issued_at DESC
     LIMIT $${params.length}`,
    params
  );
}

export async function getCertificate(id: string): Promise<CertificateRecord | null> {
  return queryOne(
    `SELECT cert.*,
            COALESCE(u.full_name, u.name) AS student_name,
            u.email AS student_email,
            c.title AS course_title,
            lp.title AS path_title,
            ad.name AS drive_name
     FROM certificates cert
     JOIN users u ON u.id = cert.student_id
     LEFT JOIN courses c ON c.id = cert.course_id
     LEFT JOIN learning_paths lp ON lp.id = cert.path_id
     LEFT JOIN assessment_drives ad ON ad.id = cert.drive_id
     WHERE cert.id = $1`,
    [id]
  );
}

async function resolveStudent(studentId: string) {
  const u = await queryOne<{ id: string; name: string; full_name: string | null; email: string }>(
    `SELECT id, name, full_name, email FROM users WHERE id = $1`,
    [studentId]
  );
  if (!u) throw new AppError("Student not found", 404);
  return u;
}

async function assertPracticeEligible(studentId: string, driveId: string, force?: boolean) {
  const drive = await queryOne<{
    id: string;
    name: string;
    drive_type: string;
  }>(`SELECT id, name, drive_type FROM assessment_drives WHERE id = $1`, [driveId]);
  if (!drive) throw new AppError("Practice assessment not found", 404);

  const attempt = await queryOne<{ id: string; status: string; score: number | null }>(
    `SELECT id, status, score FROM drive_students
     WHERE drive_id = $1 AND student_id = $2 AND status = 'completed'
     ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    [driveId, studentId]
  );

  if (!attempt && !force) {
    throw new AppError(
      "Student has not completed this practice assessment (or pass force=true).",
      400
    );
  }
  return drive;
}

async function assertCourseEligible(studentId: string, courseId: string, force?: boolean) {
  const enrollment = await queryOne<{
    progress_percent: number;
    title: string;
  }>(
    `SELECT e.progress_percent, c.title
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1 AND e.course_id = $2`,
    [studentId, courseId]
  );
  if (!enrollment) throw new AppError("Student is not enrolled in this course", 404);
  if (Number(enrollment.progress_percent) < 100 && !force) {
    throw new AppError("Course not completed (progress < 100%). Pass force=true to override.", 400);
  }
  return enrollment;
}

async function assertTrackEligible(
  studentId: string,
  pathId: string,
  force?: boolean
) {
  const path = await queryOne<{ id: string; title: string }>(
    `SELECT id, title FROM learning_paths WHERE id = $1`,
    [pathId]
  );
  if (!path) throw new AppError("Placement track (learning path) not found", 404);

  const journey = await queryOne<{
    id: string;
    status: string;
    progress_percent: number;
    placement_readiness: number;
  }>(
    `SELECT id, status, progress_percent, placement_readiness
     FROM student_journeys
     WHERE student_id = $1 AND template_id = $2
     LIMIT 1`,
    [studentId, pathId]
  );

  const done =
    journey &&
    (journey.status === "completed" ||
      Number(journey.progress_percent) >= 100 ||
      Number(journey.placement_readiness) >= 70);

  if (!done && !force) {
    throw new AppError(
      "Placement track not complete enough (need completed journey, 100% progress, or readiness ≥ 70). Pass force=true to override.",
      400
    );
  }
  return { path, journey };
}

export async function generateCertificate(input: {
  cert_type: CertType;
  student_id: string;
  course_id?: string;
  drive_id?: string;
  path_id?: string;
  title?: string;
  force?: boolean;
}): Promise<CertificateRecord> {
  const student = await resolveStudent(input.student_id);
  let title = input.title?.trim() || "";
  let courseId: string | null = null;
  let driveId: string | null = null;
  let pathId: string | null = null;
  let journeyId: string | null = null;

  if (input.cert_type === "practice_completion") {
    if (!input.drive_id) throw new AppError("drive_id is required for practice certificates", 400);
    const drive = await assertPracticeEligible(input.student_id, input.drive_id, input.force);
    driveId = drive.id;
    title = title || `${drive.name} — Practice Completion`;
  } else if (input.cert_type === "course_completion") {
    if (!input.course_id) throw new AppError("course_id is required for course certificates", 400);
    const enrollment = await assertCourseEligible(
      input.student_id,
      input.course_id,
      input.force
    );
    courseId = input.course_id;
    title = title || `${enrollment.title} — Course Completion`;
  } else if (input.cert_type === "placement_track_completion") {
    if (!input.path_id) throw new AppError("path_id is required for placement track certificates", 400);
    const { path, journey } = await assertTrackEligible(
      input.student_id,
      input.path_id,
      input.force
    );
    pathId = path.id;
    journeyId = journey?.id || null;
    title = title || `${path.title} — Placement Track Completion`;
  } else {
    throw new AppError("Invalid cert_type", 400);
  }

  // Upsert depending on type
  let cert: CertificateRecord | null = null;

  if (input.cert_type === "course_completion" && courseId) {
    cert = await queryOne(
      `INSERT INTO certificates (student_id, course_id, path_id, drive_id, journey_id, cert_type, title)
       VALUES ($1,$2,NULL,NULL,NULL,'course_completion',$3)
       ON CONFLICT (student_id, course_id) DO UPDATE SET
         title = EXCLUDED.title,
         cert_type = 'course_completion',
         issued_at = NOW()
       RETURNING *`,
      [input.student_id, courseId, title]
    );
  } else if (input.cert_type === "practice_completion" && driveId) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM certificates
       WHERE student_id = $1 AND drive_id = $2 AND cert_type = 'practice_completion'`,
      [input.student_id, driveId]
    );
    if (existing) {
      cert = await queryOne(
        `UPDATE certificates SET title = $1, issued_at = NOW() WHERE id = $2 RETURNING *`,
        [title, existing.id]
      );
    } else {
      cert = await queryOne(
        `INSERT INTO certificates (student_id, drive_id, cert_type, title)
         VALUES ($1,$2,'practice_completion',$3)
         RETURNING *`,
        [input.student_id, driveId, title]
      );
    }
  } else if (input.cert_type === "placement_track_completion" && pathId) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM certificates
       WHERE student_id = $1 AND path_id = $2 AND cert_type = 'placement_track_completion'`,
      [input.student_id, pathId]
    );
    if (existing) {
      cert = await queryOne(
        `UPDATE certificates
         SET title = $1, journey_id = COALESCE($2, journey_id), issued_at = NOW()
         WHERE id = $3 RETURNING *`,
        [title, journeyId, existing.id]
      );
    } else {
      cert = await queryOne(
        `INSERT INTO certificates (student_id, path_id, journey_id, cert_type, title)
         VALUES ($1,$2,$3,'placement_track_completion',$4)
         RETURNING *`,
        [input.student_id, pathId, journeyId, title]
      );
    }
  }

  if (!cert) throw new AppError("Failed to issue certificate", 500);

  return {
    ...cert,
    student_name: student.full_name || student.name,
    student_email: student.email,
  };
}

export async function renderCertificatePdf(id: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const cert = await getCertificate(id);
  if (!cert) throw new AppError("Certificate not found", 404);

  const achievement =
    cert.title ||
    cert.course_title ||
    cert.path_title ||
    cert.drive_name ||
    "Achievement";

  const issuedAtLabel = cert.issued_at
    ? new Date(cert.issued_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  const buffer = buildSimpleCertificatePdf({
    studentName: cert.student_name || "Student",
    achievementTitle: achievement,
    kindLabel: kindLabel(cert.cert_type || "course_completion"),
    issuedAtLabel,
    verificationCode: cert.verification_code || cert.id.slice(0, 8),
  });

  const safe = String(achievement)
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return {
    buffer,
    filename: `certificate-${safe || cert.id.slice(0, 8)}.pdf`,
  };
}

export async function searchStudentsForCert(q: string, limit = 20) {
  const term = q.trim();
  if (!term) return [];
  return query(
    `SELECT id, COALESCE(full_name, name) AS name, email, role
     FROM users
     WHERE role = 'student'
       AND (name ILIKE $1 OR full_name ILIKE $1 OR email ILIKE $1)
     ORDER BY name ASC
     LIMIT $2`,
    [`%${term}%`, limit]
  );
}

export async function listPracticeDrivesForCert(limit = 50) {
  return query(
    `SELECT id, name, drive_type, status
     FROM assessment_drives
     WHERE drive_type = 'practice_test'
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function listCoursesForCert(limit = 50) {
  return query(
    `SELECT id, title, category, status
     FROM courses
     WHERE COALESCE(status, 'published') NOT IN ('archived', 'deleted', 'draft')
     ORDER BY title ASC
     LIMIT $1`,
    [limit]
  );
}

export async function listTracksForCert(limit = 50) {
  return query(
    `SELECT id, title, domain, status
     FROM learning_paths
     WHERE status = 'published' OR domain IS NOT NULL
     ORDER BY title ASC
     LIMIT $1`,
    [limit]
  );
}

export function certificateTypeMeta() {
  return CERT_TYPES.map((value) => ({
    value,
    label: KIND_LABEL[value],
    description:
      value === "practice_completion"
        ? "Issued when a practice assessment attempt is completed."
        : value === "course_completion"
          ? "Issued when a course enrollment reaches 100% progress."
          : "Issued when a placement track / journey reaches completion or readiness ≥ 70.",
  }));
}
