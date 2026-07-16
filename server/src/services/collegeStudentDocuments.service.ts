/**
 * Sprint 2.4 — Student Documents (version-safe S3 uploads).
 */
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { query, queryOne } from "../config/database.js";
import { uploadFile, getFileBuffer } from "../config/storage.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";

export const DOC_TYPES = [
  "resume",
  "photo",
  "id_card",
  "marksheet_10th",
  "marksheet_12th",
  "degree_certificate",
] as const;

export type StudentDocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<StudentDocType, string> = {
  resume: "Resume",
  photo: "Photo",
  id_card: "ID Card",
  marksheet_10th: "10th Marksheet",
  marksheet_12th: "12th Marksheet",
  degree_certificate: "Degree Certificates",
};

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const PDF_MIME = new Set(["application/pdf"]);

const DOC_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const RULES: Record<
  StudentDocType,
  { mime: Set<string>; maxBytes: number; label: string }
> = {
  resume: { mime: DOC_MIME, maxBytes: 5 * 1024 * 1024, label: "PDF or DOC/DOCX, max 5MB" },
  photo: { mime: IMAGE_MIME, maxBytes: 2 * 1024 * 1024, label: "JPEG/PNG/WebP, max 2MB" },
  id_card: {
    mime: new Set([...IMAGE_MIME, ...PDF_MIME]),
    maxBytes: 5 * 1024 * 1024,
    label: "JPEG/PNG/WebP or PDF, max 5MB",
  },
  marksheet_10th: {
    mime: new Set([...IMAGE_MIME, ...PDF_MIME]),
    maxBytes: 5 * 1024 * 1024,
    label: "JPEG/PNG/WebP or PDF, max 5MB",
  },
  marksheet_12th: {
    mime: new Set([...IMAGE_MIME, ...PDF_MIME]),
    maxBytes: 5 * 1024 * 1024,
    label: "JPEG/PNG/WebP or PDF, max 5MB",
  },
  degree_certificate: {
    mime: new Set([...IMAGE_MIME, ...PDF_MIME]),
    maxBytes: 5 * 1024 * 1024,
    label: "JPEG/PNG/WebP or PDF, max 5MB",
  },
};

export interface StudentDocumentRow {
  id: string;
  college_id: string;
  user_id: string;
  doc_type: StudentDocType;
  version: number;
  is_current: boolean;
  original_name: string;
  mime_type: string;
  file_size: number;
  content_hash: string;
  storage_key: string;
  storage_url: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

let tableReady = false;

export async function ensureStudentDocumentsTable(): Promise<void> {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS student_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id),
      user_id UUID NOT NULL REFERENCES users(id),
      doc_type VARCHAR(50) NOT NULL,
      version INT NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT TRUE,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size INT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      storage_key TEXT NOT NULL,
      storage_url TEXT NOT NULL,
      uploaded_by UUID REFERENCES users(id),
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT student_documents_doc_type_check CHECK (
        doc_type IN (
          'resume', 'photo', 'id_card',
          'marksheet_10th', 'marksheet_12th', 'degree_certificate'
        )
      )
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_student_documents_user
      ON student_documents (user_id, doc_type) WHERE deleted_at IS NULL
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_student_documents_current
      ON student_documents (user_id, doc_type)
      WHERE is_current = TRUE AND deleted_at IS NULL
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_student_documents_hash
      ON student_documents (user_id, content_hash) WHERE deleted_at IS NULL
  `).catch(() => {});
  tableReady = true;
}

function isDocType(v: string): v is StudentDocType {
  return (DOC_TYPES as readonly string[]).includes(v);
}

async function assertStudentInCollege(collegeId: string, userId: string) {
  const row = await queryOne<{ user_id: string }>(
    `SELECT u.id AS user_id
     FROM users u
     JOIN student_details sd ON sd.user_id = u.id
     WHERE u.id = $1
       AND COALESCE(u.college_id, sd.college_id) = $2
       AND LOWER(u.role::text) = 'student'
       AND u.deleted_at IS NULL`,
    [userId, collegeId]
  );
  if (!row) throw new AppError("Student not found in this college.", 404);
}

function validateFile(docType: StudentDocType, file: Express.Multer.File) {
  const rule = RULES[docType];
  if (!rule.mime.has(file.mimetype)) {
    throw new AppError(
      `Invalid file type for ${DOC_TYPE_LABELS[docType]}. Allowed: ${rule.label}.`,
      400
    );
  }
  if (file.size > rule.maxBytes) {
    const mb = Math.round(rule.maxBytes / (1024 * 1024));
    throw new AppError(
      `File exceeds maximum size of ${mb}MB for ${DOC_TYPE_LABELS[docType]}.`,
      400
    );
  }
}

function safeExt(name: string, mime: string): string {
  const fromName = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 8) return fromName;
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("msword")) return "doc";
  return "bin";
}

export async function listStudentDocuments(collegeId: string, userId: string) {
  await ensureStudentDocumentsTable();
  await assertStudentInCollege(collegeId, userId);

  const rows = await query<StudentDocumentRow>(
    `SELECT id, college_id, user_id, doc_type, version, is_current,
            original_name, mime_type, file_size, content_hash,
            storage_key, storage_url, uploaded_by, created_at, updated_at
     FROM student_documents
     WHERE user_id = $1 AND college_id = $2 AND deleted_at IS NULL
     ORDER BY doc_type ASC, is_current DESC, version DESC`,
    [userId, collegeId]
  );

  const byType = DOC_TYPES.map((doc_type) => {
    const versions = rows.filter((r) => r.doc_type === doc_type);
    const current = versions.find((r) => r.is_current) ?? null;
    return {
      doc_type,
      label: DOC_TYPE_LABELS[doc_type],
      rules: RULES[doc_type].label,
      current: current
        ? {
            id: current.id,
            version: current.version,
            original_name: current.original_name,
            mime_type: current.mime_type,
            file_size: current.file_size,
            created_at: current.created_at,
            previewable:
              current.mime_type.startsWith("image/") || current.mime_type === "application/pdf",
          }
        : null,
      history: versions
        .filter((r) => !r.is_current)
        .map((r) => ({
          id: r.id,
          version: r.version,
          original_name: r.original_name,
          mime_type: r.mime_type,
          file_size: r.file_size,
          created_at: r.created_at,
        })),
    };
  });

  return { documents: byType };
}

export async function uploadStudentDocument(
  collegeId: string,
  userId: string,
  docTypeRaw: string,
  file: Express.Multer.File | undefined,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureStudentDocumentsTable();
  await assertStudentInCollege(collegeId, userId);

  if (!file?.buffer?.length) throw new AppError("File is required (field name: file).", 400);
  if (!isDocType(docTypeRaw)) {
    throw new AppError(
      `Invalid document type. Allowed: ${DOC_TYPES.join(", ")}.`,
      400
    );
  }
  validateFile(docTypeRaw, file);

  const contentHash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // Duplicate prevention: same content already current for this student
  const dup = await queryOne<{ id: string; doc_type: string }>(
    `SELECT id, doc_type FROM student_documents
     WHERE user_id = $1 AND college_id = $2 AND content_hash = $3
       AND is_current = TRUE AND deleted_at IS NULL
     LIMIT 1`,
    [userId, collegeId, contentHash]
  );
  if (dup) {
    throw new AppError(
      `Duplicate file: identical content already uploaded as ${DOC_TYPE_LABELS[dup.doc_type as StudentDocType] || dup.doc_type}.`,
      409
    );
  }

  const prev = await queryOne<{ id: string; version: number }>(
    `SELECT id, version FROM student_documents
     WHERE user_id = $1 AND college_id = $2 AND doc_type = $3
       AND is_current = TRUE AND deleted_at IS NULL
     LIMIT 1`,
    [userId, collegeId, docTypeRaw]
  );

  const nextVersion = (prev?.version ?? 0) + 1;
  const ext = safeExt(file.originalname, file.mimetype);
  const storageKey = `student-docs/${collegeId}/${userId}/${docTypeRaw}/v${nextVersion}-${uuidv4()}.${ext}`;
  const storageUrl = await uploadFile(storageKey, file.buffer, file.mimetype);

  if (prev) {
    await query(
      `UPDATE student_documents
       SET is_current = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [prev.id]
    );
  }

  const row = await queryOne<StudentDocumentRow>(
    `INSERT INTO student_documents
       (college_id, user_id, doc_type, version, is_current, original_name,
        mime_type, file_size, content_hash, storage_key, storage_url, uploaded_by)
     VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, college_id, user_id, doc_type, version, is_current,
               original_name, mime_type, file_size, content_hash,
               storage_key, storage_url, uploaded_by, created_at, updated_at`,
    [
      collegeId,
      userId,
      docTypeRaw,
      nextVersion,
      file.originalname.slice(0, 255),
      file.mimetype,
      file.size,
      contentHash,
      storageKey,
      storageUrl,
      actor.id,
    ]
  );

  // Keep legacy profile columns in sync for photo / resume
  if (docTypeRaw === "resume") {
    await query(`UPDATE student_details SET resume_url = $1 WHERE user_id = $2`, [
      storageUrl,
      userId,
    ]).catch(() => {});
  }
  if (docTypeRaw === "photo") {
    await query(`UPDATE student_details SET face_photo_url = $1 WHERE user_id = $2`, [
      storageUrl,
      userId,
    ]).catch(() => {});
    await query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [storageUrl, userId]).catch(
      () => {}
    );
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "STUDENT_DOCUMENT_UPLOADED",
    target_type: "student",
    target_id: userId,
    student_id: userId,
    reason: `${DOC_TYPE_LABELS[docTypeRaw]} uploaded (v${nextVersion})`,
    metadata: {
      doc_type: docTypeRaw,
      version: nextVersion,
      replaced: !!prev,
      document_id: row?.id,
      original_name: file.originalname,
      file_size: file.size,
    },
    ip_address: actor.ip,
  }).catch(() => {});

  return {
    document: row,
    replaced: !!prev,
    previous_version: prev?.version ?? null,
  };
}

async function getOwnedDocument(collegeId: string, userId: string, docId: string) {
  await ensureStudentDocumentsTable();
  await assertStudentInCollege(collegeId, userId);
  const row = await queryOne<StudentDocumentRow>(
    `SELECT id, college_id, user_id, doc_type, version, is_current,
            original_name, mime_type, file_size, content_hash,
            storage_key, storage_url, uploaded_by, created_at, updated_at
     FROM student_documents
     WHERE id = $1 AND user_id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [docId, userId, collegeId]
  );
  if (!row) throw new AppError("Document not found.", 404);
  return row;
}

export async function getStudentDocumentFile(
  collegeId: string,
  userId: string,
  docId: string
) {
  const row = await getOwnedDocument(collegeId, userId, docId);
  const { body, contentType } = await getFileBuffer(row.storage_key);
  return {
    body,
    contentType: contentType || row.mime_type,
    originalName: row.original_name,
    mimeType: row.mime_type,
    docType: row.doc_type,
    version: row.version,
  };
}

export async function deleteStudentDocument(
  collegeId: string,
  userId: string,
  docId: string,
  actor: { id: string; role: string; ip?: string }
) {
  const row = await getOwnedDocument(collegeId, userId, docId);

  await query(
    `UPDATE student_documents
     SET deleted_at = NOW(), is_current = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [docId]
  );

  // If deleting current, promote latest prior version (version-safe restore)
  if (row.is_current) {
    const prior = await queryOne<{ id: string; storage_url: string; doc_type: string }>(
      `SELECT id, storage_url, doc_type FROM student_documents
       WHERE user_id = $1 AND college_id = $2 AND doc_type = $3
         AND deleted_at IS NULL AND id <> $4
       ORDER BY version DESC
       LIMIT 1`,
      [userId, collegeId, row.doc_type, docId]
    );
    if (prior) {
      await query(
        `UPDATE student_documents SET is_current = TRUE, updated_at = NOW() WHERE id = $1`,
        [prior.id]
      );
      if (row.doc_type === "resume") {
        await query(`UPDATE student_details SET resume_url = $1 WHERE user_id = $2`, [
          prior.storage_url,
          userId,
        ]).catch(() => {});
      }
      if (row.doc_type === "photo") {
        await query(`UPDATE student_details SET face_photo_url = $1 WHERE user_id = $2`, [
          prior.storage_url,
          userId,
        ]).catch(() => {});
        await query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [
          prior.storage_url,
          userId,
        ]).catch(() => {});
      }
    } else {
      if (row.doc_type === "resume") {
        await query(`UPDATE student_details SET resume_url = NULL WHERE user_id = $1`, [
          userId,
        ]).catch(() => {});
      }
      if (row.doc_type === "photo") {
        await query(`UPDATE student_details SET face_photo_url = NULL WHERE user_id = $1`, [
          userId,
        ]).catch(() => {});
        await query(`UPDATE users SET avatar_url = NULL WHERE id = $1`, [userId]).catch(
          () => {}
        );
      }
    }
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "STUDENT_DOCUMENT_DELETED",
    target_type: "student",
    target_id: userId,
    student_id: userId,
    reason: `${DOC_TYPE_LABELS[row.doc_type]} deleted (v${row.version})`,
    metadata: {
      doc_type: row.doc_type,
      version: row.version,
      document_id: row.id,
      original_name: row.original_name,
    },
    ip_address: actor.ip,
  }).catch(() => {});

  return { success: true, deleted_id: docId };
}

export function documentRulesCatalog() {
  return DOC_TYPES.map((doc_type) => ({
    doc_type,
    label: DOC_TYPE_LABELS[doc_type],
    rules: RULES[doc_type].label,
    max_bytes: RULES[doc_type].maxBytes,
  }));
}
