import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/database.js";
import {
  ensureUserRoleEnum,
  isValidUserRoleFilter,
} from "../utils/ensureUserRoleEnum.js";
import { sendUserInvitationEmail } from "../services/email.service.js";
import { logger } from "../config/logger.js";

/**
 * List all users with filtering, search, and pagination
 * Query params: page, limit, search, role, status, college_id, from_date, to_date
 */
export const listUsers = async (req: Request, res: Response) => {
  try {
    await ensureUserRoleEnum();

    const {
      page = 1,
      limit = 50,
      search = "",
      role = "all",
      status = "all",
      college_id = "all",
      from_date = null,
      to_date = null,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = "WHERE u.deleted_at IS NULL";
    const params: any[] = [];

    // Search: name, email, phone, college
    if (search && search !== "") {
      whereClause += ` AND (
        u.full_name ILIKE $${params.length + 1}
        OR u.email ILIKE $${params.length + 1}
        OR u.phone ILIKE $${params.length + 1}
        OR c.name ILIKE $${params.length + 1}
      )`;
      params.push(`%${search}%`);
    }

    // Role filter — must cast text params to user_role (Postgres enum ≠ text)
    if (role && role !== "all") {
      const roleStr = String(role);
      if (!isValidUserRoleFilter(roleStr)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role filter: ${roleStr}`,
        });
      }
      whereClause += ` AND u.role = $${params.length + 1}::user_role`;
      params.push(roleStr);
    }

    // Status filter
    if (status && status !== "all") {
      whereClause += ` AND u.status = $${params.length + 1}`;
      params.push(status);
    }

    // College filter
    if (college_id && college_id !== "all") {
      whereClause += ` AND u.college_id = $${params.length + 1}`;
      params.push(college_id);
    }

    // Date range filter
    if (from_date) {
      whereClause += ` AND u.created_at >= $${params.length + 1}`;
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ` AND u.created_at <= $${params.length + 1}`;
      params.push(to_date);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM users u
       LEFT JOIN colleges c ON u.college_id = c.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || 0);

    // Get paginated users
    const result = await query(
      `SELECT
        u.id, u.full_name, u.email, u.phone, u.role, u.status,
        u.avatar_url, u.created_at, u.updated_at, u.last_login,
        c.id as college_id, c.name as college_name
       FROM users u
       LEFT JOIN colleges c ON u.college_id = c.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error listing users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list users",
      error: error.message,
    });
  }
};

/**
 * Advanced search with suggestions
 */
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q === "") {
      return res.json({ success: true, data: [] });
    }

    const result = await query(
      `SELECT
        id, full_name, email, avatar_url, role, college_id
       FROM users
       WHERE deleted_at IS NULL AND (
        full_name ILIKE $1 OR email ILIKE $1
       )
       ORDER BY full_name ASC
       LIMIT $2`,
      [`%${q}%`, limit]
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error searching users:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
};

/**
 * Get single user details
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        u.id, u.full_name, u.email, u.phone, u.role, u.status,
        u.avatar_url, u.created_at, u.updated_at, u.last_login,
        c.id as college_id, c.name as college_name
       FROM users u
       LEFT JOIN colleges c ON u.college_id = c.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Error getting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: error.message,
    });
  }
};

/**
 * Update user details
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, status } = req.body;

    // Partial update — at least one field must be provided
    if (full_name === undefined && email === undefined && phone === undefined && status === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field (full_name, email, phone, status) is required",
      });
    }

    // Check if user exists
    const userCheck = await query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check email uniqueness (excluding current user)
    if (email) {
      const emailCheck = await query(
        "SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL",
        [email, id]
      );

      if (emailCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    // Update user (partial — omitted fields keep their current value, so a
    // rename can't accidentally reset a suspended user back to active)
    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING id, full_name, email, phone, role, status, avatar_url, created_at, updated_at`,
      [full_name ?? null, email ?? null, phone ?? null, status ?? null, id]
    );

    res.json({
      success: true,
      message: "User updated successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

/**
 * Deactivate user (soft delete via is_active / status flags)
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userCheck = await query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await query(
      `UPDATE users
       SET status = 'inactive', is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "SOFT_DELETE_USER", "user", id, req.ip]
    );

    res.json({
      success: true,
      message: "User soft-deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deactivating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate user",
      error: error.message,
    });
  }
};

/**
 * Activate a previously deactivated user
 */
export const activateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE users
       SET status = 'active', is_active = TRUE, deleted_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, full_name, email, status`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "ACTIVATE_USER", "user", id, req.ip]
    );

    res.json({
      success: true,
      message: "User activated successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error activating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to activate user",
      error: error.message,
    });
  }
};

/**
 * Create a new platform user (invite)
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    await ensureUserRoleEnum();
    const { full_name, email, password, role, phone, college_id } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "full_name, email, password, and role are required",
      });
    }

    if (!isValidUserRoleFilter(String(role))) {
      return res.status(400).json({
        success: false,
        message: `Invalid role: ${role}`,
      });
    }

    const emailCheck = await query(
      "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
      [email]
    );
    if (emailCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already in use",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const isCollegeRole = ["college_admin", "college_staff", "college", "student", "instructor"].includes(role);
    const finalCollegeId = isCollegeRole && college_id ? college_id : null;

    const result = await query(
      `INSERT INTO users (full_name, name, email, password, role, phone, college_id, is_active, status, must_change_password)
       VALUES ($1, $1, $2, $3, $4::user_role, $5, $6, TRUE, 'active', TRUE)
       RETURNING id, full_name, email, phone, role, status, college_id, created_at`,
      [full_name, email, hashedPassword, role, phone ?? null, finalCollegeId]
    );

    try {
      await sendUserInvitationEmail({ name: full_name, email, role, temporaryPassword: password });
    } catch (emailErr) {
      logger.error("Failed to send user invitation email", { email, error: emailErr });
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};

/**
 * Suspend user account
 */
export const suspendUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason = "" } = req.body;

    // Check if user exists
    const userCheck = await query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Suspend user
    const result = await query(
      `UPDATE users
       SET status = 'suspended', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, full_name, email, status, updated_at`,
      [id]
    );

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "SUSPEND_USER",
        "user",
        id,
        JSON.stringify({ reason, status: "suspended" }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: "User suspended successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error suspending user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to suspend user",
      error: error.message,
    });
  }
};

/**
 * Unsuspend user account
 */
export const unsuspendUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userCheck = await query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Unsuspend user
    const result = await query(
      `UPDATE users
       SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, full_name, email, status, updated_at`,
      [id]
    );

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "UNSUSPEND_USER", "user", id, req.ip]
    );

    res.json({
      success: true,
      message: "User unsuspended successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error unsuspending user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsuspend user",
      error: error.message,
    });
  }
};

/**
 * Bulk user operations (suspend, delete, etc.)
 */
export const bulkUserAction = async (req: Request, res: Response) => {
  try {
    const { user_ids = [], action, reason = "" } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "user_ids array is required",
      });
    }

    if (!action || !["suspend", "delete", "deactivate", "activate"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Valid action (suspend, deactivate, activate) is required",
      });
    }

    let updateQuery = "";
    if (action === "suspend") {
      updateQuery = "UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = ANY($1) AND deleted_at IS NULL";
    } else if (action === "delete" || action === "deactivate") {
      updateQuery = "UPDATE users SET status = 'inactive', is_active = FALSE, deleted_at = NOW(), updated_at = NOW() WHERE id = ANY($1) AND deleted_at IS NULL";
    } else if (action === "activate") {
      updateQuery = "UPDATE users SET status = 'active', is_active = TRUE, deleted_at = NULL, updated_at = NOW() WHERE id = ANY($1)";
    }

    const result = await query(updateQuery, [user_ids]);

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user?.userId || "system",
        `BULK_${action.toUpperCase()}`,
        "users",
        JSON.stringify({ user_count: user_ids.length, reason }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      affected_rows: user_ids.length,
    });
  } catch (error: any) {
    console.error("Error in bulk user action:", error);
    res.status(500).json({
      success: false,
      message: "Bulk action failed",
      error: error.message,
    });
  }
};
