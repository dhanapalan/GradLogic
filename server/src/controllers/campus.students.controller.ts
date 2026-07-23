import { Request, Response, NextFunction } from "express";
import { query, queryOne, pool } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import * as studentForm from "../services/collegeStudentForm.service.js";
import * as studentBulk from "../services/collegeStudentBulk.service.js";
import * as studentDocs from "../services/collegeStudentDocuments.service.js";
import * as studentEligibility from "../services/collegeStudentEligibility.service.js";

// Utility to get string param
function getParamAsString(value: any): string {
    if (Array.isArray(value)) return value[0] ?? "";
    return typeof value === "string" ? value : "";
}

/**
 * Resolve the college ID for the current user.
 * Priority:
 *  1. users.college_id already embedded in the JWT
 *  2. For legacy 'college' role: look up colleges WHERE legacy_user_id = userId
 *  3. Throw 403 if neither resolves
 */
async function resolveCollegeId(req: Request): Promise<string> {
    const user = req.user;
    if (!user) throw new AppError("Unauthorized", 401);

    // Fast path — college_id is in the JWT
    if (user.college_id) return user.college_id;

    // Slow path — legacy 'college' role: their own user ID is the college's origin
    const row = await queryOne<{ id: string }>(
        `SELECT id FROM colleges WHERE legacy_user_id = $1`,
        [user.userId]
    );
    if (row?.id) return row.id;

    throw new AppError("Unauthorized: College context missing", 403);
}

/**
 * Faculty ("instructor" role) accounts are scoped to a single department —
 * they should only see student outcomes within it, not the whole college.
 * Not embedded in the JWT (keeps the token payload/auth flow unchanged), so
 * this does a small DB lookup for instructor callers only.
 */
async function resolveCallerDepartment(req: Request): Promise<string | null> {
    const user = req.user;
    if (!user || user.role !== "instructor") return null;
    const row = await queryOne<{ department: string | null }>(
        `SELECT department FROM users WHERE id = $1`,
        [user.userId]
    );
    return row?.department?.trim() || null;
}


/**
 * GET /api/campus/students
 * List students for physical campus with advanced filtering.
 * Required role: college_admin, college, college_staff (Data isolated to current user's college_id)
 */
export async function listStudents(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const callerDepartment = await resolveCallerDepartment(req);
        await studentEligibility.ensureEligibilitySchema().catch(() => {});

        // Extract query parameters
        const page = parseInt(getParamAsString(req.query.page)) || 1;
        const limit = parseInt(getParamAsString(req.query.limit)) || 20;
        const offset = (page - 1) * limit;

        const search = getParamAsString(req.query.search);
        const year = getParamAsString(req.query.year); // passing_year
        const department = getParamAsString(req.query.department); // specialization
        const placementStatus = getParamAsString(req.query.placementStatus);
        const riskLevel = getParamAsString(req.query.riskLevel);
        const status = getParamAsString(req.query.status); // active, suspended
        const placementEligible = getParamAsString(
            req.query.placementEligible || req.query.eligible
        ); // true | false | pending

        let sql = `
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.is_active,
                sd.id as student_id,
                sd.student_identifier as roll_number,
                sd.passing_year,
                sd.specialization as department,
                sd.degree,
                sd.cgpa::float,
                sd.face_photo_url as avatar,
                COALESCE(sd.avg_integrity_score, 0)::float as avg_integrity,
                COALESCE(sd.placement_status::text, 'Not Shortlisted') as placement_status,
                COALESCE(sd.risk_category, 'Low') as risk_level,
                COALESCE(sd.eligible_for_hiring, FALSE) as eligible_for_hiring,
                COALESCE(sd.eligible_for_hiring, FALSE) as placement_eligible,
                COALESCE(sd.active_backlogs, 0) as active_backlogs,
                COALESCE((SELECT AVG(ms.final_score) FROM marks_scored ms WHERE ms.student_id = u.id), 0)::float as avg_score
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE COALESCE(u.college_id, sd.college_id) = $1
              AND u.role = 'student'
              AND u.deleted_at IS NULL
        `;

        const params: any[] = [collegeId];
        let paramIdx = 2;

        // Faculty (instructor) accounts are locked to their own department —
        // ignore any client-supplied department filter and force it, same
        // pattern as college-scoped roles being locked to their college_id.
        if (callerDepartment) {
            sql += ` AND sd.specialization = $${paramIdx}`;
            params.push(callerDepartment);
            paramIdx++;
        }

        if (search) {
            sql += ` AND (u.name ILIKE $${paramIdx} OR sd.student_identifier ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        if (year) {
            sql += ` AND sd.passing_year = $${paramIdx}`;
            params.push(parseInt(year, 10));
            paramIdx++;
        }

        if (department) {
            sql += ` AND sd.specialization ILIKE $${paramIdx}`;
            params.push(`%${department}%`);
            paramIdx++;
        }

        if (placementStatus) {
            sql += ` AND sd.placement_status = $${paramIdx}`;
            params.push(placementStatus);
            paramIdx++;
        }

        if (riskLevel) {
            sql += ` AND sd.risk_category = $${paramIdx}`;
            params.push(riskLevel);
            paramIdx++;
        }

        if (status) {
            sql += ` AND u.is_active = $${paramIdx}`;
            params.push(status === "active");
            paramIdx++;
        }

        if (placementEligible === "true" || placementEligible === "eligible") {
            sql += ` AND COALESCE(sd.eligible_for_hiring, FALSE) = TRUE`;
        } else if (
            placementEligible === "false" ||
            placementEligible === "ineligible" ||
            placementEligible === "not_eligible"
        ) {
            sql += ` AND COALESCE(sd.eligible_for_hiring, FALSE) = FALSE`;
        } else if (placementEligible === "pending" || placementEligible === "eligibility_pending") {
            sql += ` AND COALESCE(sd.eligible_for_hiring, FALSE) = FALSE AND u.is_active = TRUE`;
        }

        // Count for pagination
        const countSql = `SELECT COUNT(*) FROM (${sql}) AS subquery`;
        const countResult = await queryOne(countSql, params);
        const total = parseInt(countResult?.count || "0", 10);

        sql += ` ORDER BY u.name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(limit, offset);

        const students = await query(sql, params);

        res.json({
            success: true,
            data: students,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/analytics
 * Get 4-5 KPI summary cards for the students screen.
 */
export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);

        const stats = await queryOne(`
            SELECT 
                COUNT(u.id)::int as total_students,
                SUM(CASE WHEN u.is_active THEN 1 ELSE 0 END)::int as active_students,
                ROUND(AVG(COALESCE(sd.cgpa, 0))::numeric, 2)::float as avg_score,
                ROUND(AVG(COALESCE(sd.avg_integrity_score, 0))::numeric, 2)::float as avg_integrity,
                SUM(CASE WHEN sd.placement_status IN ('Shortlisted', 'Interviewed', 'Offered', 'Joined') THEN 1 ELSE 0 END)::int as placed_pipeline_count,
                SUM(CASE WHEN sd.risk_category = 'High' THEN 1 ELSE 0 END)::int as high_risk_count
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE COALESCE(u.college_id, sd.college_id) = $1 AND u.role = 'student'
        `, [collegeId]);


        // Mock Appeared in latest drive count since complicated logic varies
        const appearedLatestDrive = Math.floor((stats?.total_students || 0) * 0.7);

        res.json({
            success: true,
            data: {
                totalStudents: stats?.total_students || 0,
                activeStudents: stats?.active_students || 0,
                avgScore: stats?.avg_score || 0,
                avgIntegrity: stats?.avg_integrity || 0,
                appearedInLatestDrive: appearedLatestDrive,
                placedPipelineCount: stats?.placed_pipeline_count || 0,
                highRiskCount: stats?.high_risk_count || 0
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/:id
 * Deep student profile with tabs data.
 */
export async function getStudentProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const callerDepartment = await resolveCallerDepartment(req);
        const studentId = req.params.id; // user_id
        await studentForm.ensureStudentFormColumns().catch(() => {});
        await studentEligibility.ensureEligibilitySchema().catch(() => {});

        const student = await queryOne<Record<string, unknown>>(`
            SELECT
                u.id AS user_id,
                u.name,
                u.email,
                u.is_active,
                COALESCE(u.avatar_url, sd.face_photo_url) AS photo_url,
                sd.id AS student_id,
                sd.student_identifier AS roll_number,
                COALESCE(sd.register_number, sd.student_identifier) AS register_number,
                COALESCE(sd.phone_number, u.phone_number) AS phone_number,
                sd.gender,
                COALESCE(sd.dob, u.dob)::text AS dob,
                COALESCE(NULLIF(TRIM(sd.specialization), ''), NULLIF(TRIM(sd.degree), ''), NULLIF(TRIM(sd.class_name), '')) AS department,
                sd.degree AS program,
                sd.passing_year AS academic_year,
                COALESCE(NULLIF(TRIM(sd.class_name), ''), sd.passing_year::text) AS batch,
                NULLIF(TRIM(sd.semester), '') AS semester,
                NULLIF(TRIM(sd.section), '') AS section,
                sd.cgpa::float AS cgpa,
                sd.degree,
                sd.specialization,
                sd.passing_year,
                sd.class_name,
                COALESCE(sd.eligible_for_hiring, FALSE) AS placement_eligible,
                sd.eligibility_reason,
                sd.eligibility_date::text AS eligibility_date,
                sd.eligibility_verified_by,
                v.name AS eligibility_verified_by_name,
                sd.eligibility_verified_at::text AS eligibility_verified_at,
                COALESCE(sd.active_backlogs, 0) AS active_backlogs,
                COALESCE(sd.eligibility_manual_override, FALSE) AS eligibility_manual_override,
                COALESCE(sd.avg_integrity_score, 0)::float AS avg_integrity,
                COALESCE(sd.placement_status::text, 'Not Shortlisted') AS placement_status,
                COALESCE(sd.risk_category, 'Low') AS risk_level,
                COALESCE((SELECT AVG(ms.final_score) FROM marks_scored ms WHERE ms.student_id = u.id), 0)::float AS avg_score
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            LEFT JOIN users v ON v.id = sd.eligibility_verified_by
            WHERE u.id = $1
              AND COALESCE(u.college_id, sd.college_id) = $2
              AND LOWER(u.role::text) = 'student'
        `, [studentId, collegeId]);

        if (!student) {
            throw new AppError("Student not found or access denied", 404);
        }
        if (callerDepartment && student.department !== callerDepartment) {
            throw new AppError("Student not found or access denied", 404);
        }

        let readinessScore: number | null = null;
        try {
            const ready = await queryOne<{ readiness_score: string | null }>(
                `SELECT AVG(sj.placement_readiness)::float::text AS readiness_score
                 FROM student_journeys sj
                 WHERE sj.student_id = $1
                   AND sj.status IN ('in_progress', 'completed', 'paused')`,
                [studentId]
            );
            readinessScore =
                ready?.readiness_score != null ? Number(ready.readiness_score) : null;
        } catch {
            readinessScore = null;
        }
        student.readiness_score = readinessScore;

        // Keep assessments / violations in payload for older clients; UI tabs use overview only.
        let assessments: unknown[] = [];
        let violations: unknown[] = [];
        try {
            assessments = await query(`
                SELECT e.id as drive_id, e.title, ms.final_score as score, ms.created_at
                FROM marks_scored ms
                JOIN exams e ON e.id = ms.exam_id
                WHERE ms.student_id = $1
                ORDER BY ms.created_at DESC
            `, [studentId]);
        } catch { /* optional */ }

        try {
            violations = await query(`
                SELECT id, violation_type, risk_score, timestamp
                FROM cheating_logs
                WHERE student_id = $1
                ORDER BY timestamp DESC
            `, [studentId]);
        } catch { /* optional */ }

        res.json({
            success: true,
            data: {
                overview: student,
                assessments,
                violations,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/campus/students/:id
 * Sprint 2.2 — full profile update (college-scoped).
 */
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = req.params.id;
        const body = { ...req.body };

        // Map legacy field names from older clients
        if (body.student_identifier && !body.roll_number) body.roll_number = body.student_identifier;
        if (body.specialization && !body.department) body.department = body.specialization;
        if (body.degree && !body.program) body.program = body.degree;
        if (body.class_name && !body.batch) body.batch = body.class_name;
        if (body.passing_year != null && body.academic_year == null) {
            body.academic_year = body.passing_year;
        }

        // Partial legacy updates (status/risk only) — keep backward compatible
        if (
            body.roll_number == null &&
            body.name == null &&
            (body.placement_status != null ||
                body.risk_level != null ||
                body.is_active != null ||
                body.phone_number != null ||
                body.cgpa != null)
        ) {
            const student = await queryOne(
                `SELECT id FROM student_details WHERE user_id = $1 AND COALESCE(
                    (SELECT college_id FROM users WHERE id = $1), college_id) = $2`,
                [studentId, collegeId]
            );
            if (!student) throw new AppError("Student not found", 404);
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                if (body.is_active !== undefined) {
                    await client.query(`UPDATE users SET is_active = $1 WHERE id = $2`, [
                        body.is_active,
                        studentId,
                    ]);
                }
                const fields: string[] = [];
                const params: unknown[] = [];
                let idx = 1;
                const setField = (column: string, value: unknown) => {
                    fields.push(`${column} = $${idx++}`);
                    params.push(value);
                };
                if (body.placement_status !== undefined) setField("placement_status", body.placement_status);
                if (body.risk_level !== undefined) setField("risk_category", body.risk_level);
                if (body.phone_number !== undefined) setField("phone_number", body.phone_number);
                if (body.degree !== undefined) setField("degree", body.degree);
                if (body.specialization !== undefined) setField("specialization", body.specialization);
                if (body.passing_year !== undefined) setField("passing_year", body.passing_year);
                if (body.cgpa !== undefined) setField("cgpa", body.cgpa);
                if (fields.length) {
                    params.push(studentId);
                    await client.query(
                        `UPDATE student_details SET ${fields.join(", ")} WHERE user_id = $${idx}`,
                        params
                    );
                }
                await client.query("COMMIT");
                res.json({ success: true, message: "Student updated successfully" });
            } catch (e) {
                await client.query("ROLLBACK");
                throw e;
            } finally {
                client.release();
            }
            return;
        }

        const data = await studentForm.updateCampusStudent(collegeId, studentId, body, {
            id: req.user!.userId,
            role: req.user!.role,
            ip: typeof req.ip === "string" ? req.ip : undefined,
        });
        res.json({ success: true, data, message: "Student updated successfully" });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/bulk-template
 * Download sample Excel template.
 */
export async function downloadBulkTemplate(req: Request, res: Response, next: NextFunction) {
    try {
        await resolveCollegeId(req);
        const buf = studentBulk.buildSampleTemplateBuffer();
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="student_bulk_upload_template.xlsx"'
        );
        res.send(buf);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/campus/students/bulk-validate
 * multipart field "file" — Excel (.xlsx / .xls)
 */
export async function bulkValidate(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const file = req.file;
        if (!file?.buffer?.length) {
            throw new AppError("Excel file is required (field name: file).", 400);
        }
        const name = (file.originalname || "").toLowerCase();
        if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
            throw new AppError("Upload an Excel file (.xlsx or .xls).", 400);
        }
        const parsed = studentBulk.parseExcelBuffer(file.buffer);
        const result = await studentBulk.validateBulkRows(collegeId, parsed);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/campus/students/bulk-import
 * Body: { rows: ValidatedBulkRow[] } from validate step
 * Legacy: { students: [...] } still accepted and re-validated.
 */
export async function bulkImport(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        let rows = Array.isArray(req.body?.rows) ? req.body.rows : null;

        if (!rows?.length && Array.isArray(req.body?.students)) {
            const mapped = (req.body.students as Record<string, unknown>[]).map((s) => ({
                roll_number: String(s.roll_number || s.student_identifier || s.student_id || ""),
                register_number: String(s.register_number || ""),
                name: String(s.name || ""),
                gender: String(s.gender || ""),
                dob: String(s.dob || ""),
                email: String(s.email || ""),
                phone_number: String(s.phone_number || ""),
                department: String(s.department || s.specialization || ""),
                program: String(s.program || s.degree || ""),
                batch: String(s.batch || s.class_name || s.passing_year || ""),
                semester: String(s.semester || ""),
                section: String(s.section || ""),
                academic_year: String(s.academic_year || s.passing_year || ""),
                cgpa: String(s.cgpa ?? ""),
                placement_eligible: String(s.placement_eligible ?? ""),
                placement_status: String(s.placement_status || "Not Shortlisted"),
            }));
            const validated = await studentBulk.validateBulkRows(collegeId, mapped);
            rows = validated.rows;
        }

        if (!rows?.length) {
            throw new AppError("rows array is required (run validate first).", 400);
        }

        const result = await studentBulk.importValidatedRows(collegeId, rows, {
            id: req.user!.userId,
            role: req.user!.role,
            ip: typeof req.ip === "string" ? req.ip : undefined,
        });

        res.status(201).json({
            success: true,
            data: result,
            message: `Imported ${result.summary.successful} of ${result.summary.total} student(s)`,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/campus/students/bulk-error-report
 * Body: { failed: [...] } → Excel error report download
 */
export async function bulkErrorReport(req: Request, res: Response, next: NextFunction) {
    try {
        await resolveCollegeId(req);
        const failed = Array.isArray(req.body?.failed) ? req.body.failed : [];
        if (!failed.length) throw new AppError("failed array is required", 400);
        const buf = studentBulk.buildErrorReportBuffer(failed);
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="student_bulk_errors.xlsx"'
        );
        res.send(buf);
    } catch (err) {
        next(err);
    }
}

export async function bulkAction(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);

        const { action, studentIds, payload } = req.body;
        if (!Array.isArray(studentIds) || !studentIds.length) {
            throw new AppError("Student IDs required", 400);
        }

        if (action === "suspend" || action === "soft_delete") {
            await query(
                `
                UPDATE users
                SET is_active = FALSE,
                    status = 'inactive',
                    deleted_at = CASE WHEN $3::text = 'soft_delete' THEN NOW() ELSE deleted_at END,
                    updated_at = NOW()
                WHERE id IN (
                    SELECT u.id FROM users u JOIN student_details sd ON sd.user_id = u.id
                    WHERE u.id = ANY($2::uuid[])
                      AND COALESCE(u.college_id, sd.college_id) = $1
                      AND u.deleted_at IS NULL
                )
            `,
                [collegeId, studentIds, action],
            );
        } else if (action === "activate") {
            await query(
                `
                UPDATE users
                SET is_active = TRUE, status = 'active', deleted_at = NULL, updated_at = NOW()
                WHERE id IN (
                    SELECT u.id FROM users u JOIN student_details sd ON sd.user_id = u.id
                    WHERE u.id = ANY($2::uuid[])
                      AND COALESCE(u.college_id, sd.college_id) = $1
                )
            `,
                [collegeId, studentIds],
            );
        } else if (action === "update_placement") {
            await query(
                `
                UPDATE student_details sd
                SET placement_status = $2
                FROM users u
                WHERE sd.user_id = u.id
                  AND u.id = ANY($3::uuid[])
                  AND COALESCE(u.college_id, sd.college_id) = $1
                  AND u.deleted_at IS NULL
            `,
                [collegeId, payload?.placement_status, studentIds],
            );
        } else {
            throw new AppError(`Unknown bulk action: ${action}`, 400);
        }
        res.json({ success: true, message: `Action ${action} executed` });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/campus/students — create student in caller's college only
 */
export async function createStudent(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const body = { ...req.body };
        // Legacy modal field mapping
        if (body.student_identifier && !body.roll_number) body.roll_number = body.student_identifier;
        if (body.specialization && !body.department) body.department = body.specialization;
        if (body.degree && !body.program) body.program = body.degree;
        if (body.passing_year != null && body.academic_year == null) {
            body.academic_year = body.passing_year;
        }
        if (!body.batch && (body.class_name || body.academic_year || body.passing_year)) {
            body.batch = body.class_name || String(body.academic_year || body.passing_year);
        }

        const user = await studentForm.createCampusStudent(collegeId, body, {
            id: req.user!.userId,
            role: req.user!.role,
            ip: typeof req.ip === "string" ? req.ip : undefined,
        });
        res.status(201).json({
            success: true,
            data: user,
            message: "Student created successfully",
        });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/campus/students/:id — soft delete (own college only)
 */
export async function softDeleteStudent(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = req.params.id;

        const result = await query(
            `
            UPDATE users u
            SET status = 'inactive', is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
            FROM student_details sd
            WHERE u.id = sd.user_id
              AND u.id = $2
              AND u.role = 'student'
              AND u.deleted_at IS NULL
              AND COALESCE(u.college_id, sd.college_id) = $1
            RETURNING u.id
        `,
            [collegeId, studentId],
        );

        if (!result.length) throw new AppError("Student not found", 404);
        res.json({ success: true, message: "Student soft-deleted successfully" });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/:id/documents
 */
export async function listStudentDocuments(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const data = await studentDocs.listStudentDocuments(collegeId, studentId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/campus/students/:id/documents
 * multipart: file + doc_type
 */
export async function uploadStudentDocument(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const docType = getParamAsString(req.body?.doc_type || req.query.doc_type);
        const result = await studentDocs.uploadStudentDocument(
            collegeId,
            studentId,
            docType,
            req.file,
            {
                id: req.user!.userId,
                role: req.user!.role,
                ip: typeof req.ip === "string" ? req.ip : undefined,
            }
        );
        res.status(201).json({
            success: true,
            data: result,
            message: result.replaced
                ? "Document replaced (previous version retained)"
                : "Document uploaded",
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/:id/documents/:docId/download
 */
export async function downloadStudentDocument(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const docId = getParamAsString(req.params.docId);
        const file = await studentDocs.getStudentDocumentFile(collegeId, studentId, docId);
        res.setHeader("Content-Type", file.contentType);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(file.originalName)}"`
        );
        res.setHeader("Cache-Control", "private, no-store");
        res.send(file.body);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/:id/documents/:docId/preview
 */
export async function previewStudentDocument(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const docId = getParamAsString(req.params.docId);
        const file = await studentDocs.getStudentDocumentFile(collegeId, studentId, docId);
        res.setHeader("Content-Type", file.contentType);
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${encodeURIComponent(file.originalName)}"`
        );
        res.setHeader("Cache-Control", "private, max-age=60");
        res.send(file.body);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/campus/students/:id/documents/:docId
 */
export async function deleteStudentDocument(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const docId = getParamAsString(req.params.docId);
        const result = await studentDocs.deleteStudentDocument(collegeId, studentId, docId, {
            id: req.user!.userId,
            role: req.user!.role,
            ip: typeof req.ip === "string" ? req.ip : undefined,
        });
        res.json({ success: true, data: result, message: "Document deleted" });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/:id/eligibility
 */
export async function getStudentEligibility(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const data = await studentEligibility.getEligibility(collegeId, studentId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campus/students/:id/eligibility/history
 */
export async function getStudentEligibilityHistory(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const data = await studentEligibility.getEligibilityHistory(collegeId, studentId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/campus/students/:id/eligibility
 * Body: { eligible: boolean, reason: string, active_backlogs?, eligibility_date? }
 */
export async function setStudentEligibility(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = getParamAsString(req.params.id);
        const eligible = req.body?.eligible;
        if (typeof eligible !== "boolean") {
            throw new AppError("eligible (boolean) is required.", 400);
        }
        const data = await studentEligibility.setEligibility(
            collegeId,
            studentId,
            {
                eligible,
                reason: req.body?.reason,
                active_backlogs: req.body?.active_backlogs,
                eligibility_date: req.body?.eligibility_date,
                change_source: req.body?.change_source || "manual",
            },
            {
                id: req.user!.userId,
                role: req.user!.role,
                ip: typeof req.ip === "string" ? req.ip : undefined,
            }
        );
        res.json({
            success: true,
            data,
            message: eligible ? "Student marked eligible" : "Student marked not eligible",
        });
    } catch (err) {
        next(err);
    }
}
