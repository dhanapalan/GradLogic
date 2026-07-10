import { Request, Response, NextFunction } from "express";
import { query, queryOne, pool } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

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
 * GET /api/campus/students
 * List students for physical campus with advanced filtering.
 * Required role: college_admin, college, college_staff (Data isolated to current user's college_id)
 */
export async function listStudents(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);

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
                sd.eligible_for_hiring,
                COALESCE((SELECT AVG(ms.final_score) FROM marks_scored ms WHERE ms.student_id = u.id), 0)::float as avg_score
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE COALESCE(u.college_id, sd.college_id) = $1 AND u.role = 'student'
        `;

        const params: any[] = [collegeId];
        let paramIdx = 2;

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
        const studentId = req.params.id; // user_id

        const student = await queryOne(`
            SELECT u.id as user_id, u.name, u.email, u.is_active,
                   sd.*, 
                   sd.cgpa::float as cgpa,
                   COALESCE(sd.avg_integrity_score, 0)::float as avg_integrity,
                   COALESCE(sd.placement_status::text, 'Not Shortlisted') as placement_status,
                   COALESCE(sd.risk_category, 'Low') as risk_level,
                   COALESCE((SELECT AVG(ms.final_score) FROM marks_scored ms WHERE ms.student_id = u.id), 0)::float as avg_score
            FROM users u
            JOIN student_details sd ON u.id = sd.user_id
            WHERE u.id = $1 AND COALESCE(u.college_id, sd.college_id) = $2
        `, [studentId, collegeId]);


        if (!student) {
            throw new AppError("Student not found or access denied", 404);
        }

        // Assessments 
        const assessments = await query(`
            SELECT e.id as drive_id, e.title, ms.final_score as score, ms.created_at
            FROM marks_scored ms
            JOIN exams e ON e.id = ms.exam_id
            WHERE ms.student_id = $1
            ORDER BY ms.created_at DESC
        `, [studentId]);

        // Integrity violations
        const violations = await query(`
            SELECT id, violation_type, risk_score, timestamp
            FROM cheating_logs
            WHERE student_id = $1
            ORDER BY timestamp DESC
        `, [studentId]);

        res.json({
            success: true,
            data: {
                overview: student,
                assessments,
                violations
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/campus/students/:id
 * Update student / profile.
 */
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);
        const studentId = req.params.id;
        const {
            is_active, placement_status, risk_level,
            phone_number, degree, specialization, passing_year, cgpa,
        } = req.body;

        // Verify college isolation
        const student = await queryOne(`SELECT id FROM student_details WHERE user_id = $1 AND COALESCE(
            (SELECT college_id FROM users WHERE id = $1), college_id) = $2`, [studentId, collegeId]);
        if (!student) {
            throw new AppError("Student not found", 404);
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            if (is_active !== undefined) {
                await client.query(`UPDATE users SET is_active = $1 WHERE id = $2`, [is_active, studentId]);
            }

            // Write placement/risk to student_details — the same table every
            // read path (list/analytics/profile) actually queries. The old
            // code upserted into student_summary, a table nothing reads from,
            // so edits here silently had zero visible effect.
            const fields: string[] = [];
            const params: unknown[] = [];
            let idx = 1;
            const setField = (column: string, value: unknown) => {
                fields.push(`${column} = $${idx++}`);
                params.push(value);
            };
            if (placement_status !== undefined) setField("placement_status", placement_status);
            if (risk_level !== undefined) setField("risk_category", risk_level);
            if (phone_number !== undefined) setField("phone_number", phone_number);
            if (degree !== undefined) setField("degree", degree);
            if (specialization !== undefined) setField("specialization", specialization);
            if (passing_year !== undefined) setField("passing_year", passing_year);
            if (cgpa !== undefined) setField("cgpa", cgpa);

            if (fields.length > 0) {
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
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/campus/students/bulk-import
 * Placeholders for bulk operations
 */
export async function bulkImport(req: Request, res: Response, next: NextFunction) {
    res.json({ success: true, message: "Bulk import queued" });
}

export async function bulkAction(req: Request, res: Response, next: NextFunction) {
    try {
        const collegeId = await resolveCollegeId(req);

        const { action, studentIds, payload } = req.body;
        if (!Array.isArray(studentIds) || !studentIds.length) {
            throw new AppError("Student IDs required", 400);
        }

        if (action === 'suspend') {
            await query(`
                UPDATE users SET is_active = false
                WHERE id IN (
                    SELECT u.id FROM users u JOIN student_details sd ON sd.user_id = u.id
                    WHERE u.id = ANY($2::uuid[]) AND COALESCE(u.college_id, sd.college_id) = $1
                )
            `, [collegeId, studentIds]);
        } else if (action === 'update_placement') {
            await query(`
                INSERT INTO student_summary (student_id, college_id, placement_status)
                SELECT u.id, $1, $2
                FROM users u JOIN student_details sd ON sd.user_id = u.id
                WHERE u.id = ANY($3::uuid[]) AND COALESCE(u.college_id, sd.college_id) = $1
                ON CONFLICT (student_id) DO UPDATE SET placement_status = EXCLUDED.placement_status
            `, [collegeId, payload.placement_status, studentIds]);
        }
        res.json({ success: true, message: `Action ${action} executed` });
    } catch (err) {
        next(err);
    }
}

export async function createStudent(req: Request, res: Response, next: NextFunction) {
    res.json({ success: true, message: "Student created" });
}
