import { Request, Response, NextFunction } from "express";
import { query, queryOne } from "../config/database.js";
import { ApiResponse, UserRow } from "../types/index.js";
import { AppError } from "../middleware/errorHandler.js";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "../services/audit.service.js";

/**
 * List all system users with optional role filtering
 */
export const listUsers = async (
    req: Request,
    res: Response<ApiResponse<UserRow[]>>,
    next: NextFunction
) => {
    try {
        const { role, search } = req.query;
        let sql = `
            SELECT 
                u.id, u.role, u.name, u.email, 
                u.is_active, u.status, u.login_type, u.last_login_at, u.created_at, u.updated_at,
                c.name as college_name
            FROM users u
            LEFT JOIN colleges c ON c.id = u.college_id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (role) {
            params.push(role);
            sql += ` AND u.role = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }

        sql += ` ORDER BY u.created_at DESC LIMIT 200`;

        const users = await query<UserRow>(sql, params);
        res.json({ success: true, data: users });
    } catch (err) {
        next(err);
    }
};

/**
 * List all company accounts with their profile and activity stats — the
 * "Company Management" superadmin view. company.routes.ts only exposes
 * self-service endpoints (a company managing its own profile/drives), so
 * this is genuinely new: an admin-facing list across all companies.
 */
export const listCompanies = async (
    _req: Request,
    res: Response<ApiResponse<unknown[]>>,
    next: NextFunction
) => {
    try {
        const rows = await query(`
            SELECT
                u.id, u.email, u.name AS contact_name, u.is_active, u.status, u.created_at,
                c.id AS company_id, c.name AS company_name, c.industry, c.website, c.headquarters,
                (SELECT COUNT(*)::int FROM assessment_drives ad WHERE ad.created_by = u.id) AS drives_created,
                (SELECT COUNT(*)::int FROM drive_students ds
                   JOIN assessment_drives ad2 ON ad2.id = ds.drive_id
                   WHERE ad2.created_by = u.id) AS candidates_reached
            FROM users u
            LEFT JOIN companies c ON c.user_id = u.id
            WHERE u.role = 'company'
            ORDER BY u.created_at DESC
            LIMIT 200
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
};

/**
 * Update a user's system role
 */
export const updateUserRole = async (
    req: Request,
    res: Response<ApiResponse<UserRow>>,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
            throw new AppError("Role is required", 400);
        }

        const validRoles = [
            "super_admin", "admin", "hr", "engineer", "cxo",
            "college_admin", "college_staff", "student"
        ];
        if (!validRoles.includes(role)) {
            throw new AppError("Invalid role specified", 400);
        }

        const updatedUser = await queryOne<UserRow>(
            `UPDATE users 
             SET role = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING id, role, email, name, is_active, status, login_type`,
            [role, id]
        );

        if (!updatedUser) {
            throw new AppError("User not found", 404);
        }

        res.json({
            success: true,
            data: updatedUser,
            message: `User role updated to ${role}`
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update a user
 */
export const updateUser = async (
    req: Request,
    res: Response<ApiResponse<UserRow>>,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const { name, email, role, college_id } = req.body;

        if (!name || !email || !role) {
            throw new AppError("Name, email, and role are required", 400);
        }

        const validRoles = [
            "super_admin", "admin", "hr", "engineer", "cxo",
            "college_admin", "college_staff", "student", "college"
        ];
        if (!validRoles.includes(role)) {
            throw new AppError("Invalid role specified", 400);
        }

        const isCollegeRole = ["college_admin", "college_staff", "college", "student", "instructor"].includes(role);
        const finalCollegeId = isCollegeRole && college_id ? college_id : null;

        const existing = await queryOne<UserRow>("SELECT id FROM users WHERE email = $1 AND id != $2", [email, id]);
        if (existing) {
            throw new AppError("Email already in use", 409);
        }

        const updatedUser = await queryOne<UserRow>(
            `UPDATE users SET name = $1, email = $2, role = $3::user_role, college_id = $4, updated_at = NOW() WHERE id = $5 RETURNING id, name, email, role, is_active, status, login_type`,
            [name, email, role, finalCollegeId, id]
        );

        if (!updatedUser) {
            throw new AppError("User not found", 404);
        }

        res.json({ success: true, data: updatedUser, message: "User updated successfully" });
    } catch (err) {
        next(err);
    }
};

/**
 * Create a new system user
 */
export const createUser = async (
    req: Request,
    res: Response<ApiResponse<UserRow>>,
    next: NextFunction
) => {
    try {
        const { name, email, password, role, login_type, college_id } = req.body;

        if (!name || !email || !password || !role) {
            throw new AppError("Name, email, password, and role are required", 400);
        }

        const existing = await queryOne<UserRow>(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );
        if (existing) {
            throw new AppError("Email already in use", 409);
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const loginTypeVal = login_type || "Email_Password";


        const isCollegeRole = ["college_admin", "college_staff", "college", "student", "instructor"].includes(role);
        const finalCollegeId = isCollegeRole && college_id ? college_id : null;

        const user = await queryOne<UserRow>(
            `INSERT INTO users (name, email, password, role, is_active, status, login_type, college_id)
             VALUES ($1, $2, $3, $4::user_role, TRUE, 'Active', $5, $6)
             RETURNING id, name, email, role, is_active, status, login_type, college_id, created_at`,
            [name, email, hashedPassword, role, loginTypeVal, finalCollegeId]
        );

        if (!user) {
            throw new AppError("Failed to create user record", 500);
        }

        // Audit Logging
        await writeAuditLog({
            actor_id: (req as any).user?.userId || "system",
            actor_role: (req as any).user?.role || "unknown",
            action: "USER_CREATED",
            target_type: "user",
            target_id: user.id,
            reason: `Manual creation by admin (${user.role})`,
            metadata: { email: user.email }
        }).catch(err => console.error("Audit log failed", err));

        res.status(201).json({
            success: true,
            data: user,
            message: "User created successfully"
        });
    } catch (err) {
        console.error("DEBUG: createUser error details:", err);
        next(err);
    }
};

/**
 * Update a user's status (Activate/Deactivate/Lock)
 */
export const updateUserStatus = async (
    req: Request,
    res: Response<ApiResponse<UserRow>>,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // e.g., 'Active', 'Inactive', 'Locked'

        if (!status) {
            throw new AppError("Status is required", 400);
        }

        const validStatuses = ["Active", "Inactive", "Locked"];
        if (!validStatuses.includes(status)) {
            throw new AppError("Invalid status specified", 400);
        }

        const updatedUser = await queryOne<UserRow>(
            `UPDATE users 
             SET status = $1, is_active = $2, updated_at = NOW() 
             WHERE id = $3 
             RETURNING id, role, email, name, is_active, status`,
            [status, status === "Active", id]
        );

        if (!updatedUser) {
            throw new AppError("User not found", 404);
        }

        // Audit Logging
        await writeAuditLog({
            actor_id: (req as any).user?.userId || "system",
            actor_role: (req as any).user?.role || "unknown",
            action: `USER_STATUS_CHANGED`,
            target_type: "user",
            target_id: updatedUser.id,
            reason: `Status changed to ${status}`,
        }).catch(err => console.error("Audit log failed", err));

        res.json({
            success: true,
            data: updatedUser,
            message: `User status updated to ${status}`
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Admin forces a password reset or sends a reset link
 * For this MVP, we just set a must_change_password flag & change the password to a temp one.
 */
export const resetPassword = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const tempPassword = "ChangeMe123!"; // Realistically: generating a random strong password or sending a reset link string via email
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        const updatedUser = await queryOne<UserRow>(
            `UPDATE users 
             SET password = $1, must_change_password = TRUE, updated_at = NOW() 
             WHERE id = $2 
             RETURNING id, email, name`,
            [hashedPassword, id]
        );

        if (!updatedUser) {
            throw new AppError("User not found", 404);
        }

        // Audit Logging
        await writeAuditLog({
            actor_id: (req as any).user?.userId || "system",
            actor_role: (req as any).user?.role || "unknown",
            action: "USER_PASSWORD_RESET",
            target_type: "user",
            target_id: updatedUser.id,
            reason: `Admin forced password reset`,
            metadata: { email: updatedUser.email }
        }).catch(err => console.error("Audit log failed", err));

        res.json({
            success: true,
            message: `Password reset to temporary password. User must change on next login.`
        });
    } catch (err) {
        next(err);
    }
};
/**
 * Admin updates a user's password to a specific value
 */
export const updatePassword = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            throw new AppError('Password must be at least 6 characters', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const updatedUser = await queryOne<UserRow>(
            `UPDATE users 
             SET password = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING id, email, name`,
            [hashedPassword, id]
        );

        if (!updatedUser) {
            throw new AppError('User not found', 404);
        }

        // Audit Logging
        await writeAuditLog({
            actor_id: (req as any).user?.userId || 'system',
            actor_role: (req as any).user?.role || 'unknown',
            action: 'USER_PASSWORD_RESET',
            target_type: 'user',
            target_id: updatedUser.id,
            reason: 'Admin changed user password',
            metadata: { email: updatedUser.email }
        }).catch(err => console.error('Audit log failed', err));

        res.json({
            success: true,
            message: 'Password updated successfully.'
        });
    } catch (err) {
        next(err);
    }
};
