import { Request, Response } from "express";
import { query } from "../config/database.js";
import { invalidateRbacCache } from "../services/rbac.service.js";

// System roles that cannot be deleted
const SYSTEM_ROLES = ["super_admin", "college_admin", "tpo", "mentor", "student"];

/**
 * List all roles with usage statistics
 */
export const listRoles = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
        r.id, r.name, r.description, r.is_system,
        r.created_at, r.updated_at,
        COUNT(u.id) as user_count
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id AND u.deleted_at IS NULL
       WHERE r.deleted_at IS NULL
       GROUP BY r.id
       ORDER BY r.is_system DESC, r.name ASC`
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error listing roles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list roles",
      error: error.message,
    });
  }
};

/**
 * Get single role with all permissions
 */
export const getRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const roleResult = await query(
      `SELECT id, name, description, is_system, created_at, updated_at
       FROM roles
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (roleResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const role = roleResult[0];

    // Get permissions for this role
    const permissionsResult = await query(
      `SELECT p.id, p.name, p.description, p.category
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.category, p.name`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...role,
        permissions: permissionsResult,
      },
    });
  } catch (error: any) {
    console.error("Error getting role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get role",
      error: error.message,
    });
  }
};

/**
 * Create custom role
 */
export const createRole = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    // Validate input
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    // Check if role name already exists
    const existingRole = await query(
      "SELECT id FROM roles WHERE name = $1 AND deleted_at IS NULL",
      [name]
    );

    if (existingRole.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Role name already exists",
      });
    }

    // Create role
    const result = await query(
      `INSERT INTO roles (name, description, is_system, created_at, updated_at)
       VALUES ($1, $2, false, NOW(), NOW())
       RETURNING id, name, description, is_system, created_at, updated_at`,
      [name, description || null]
    );

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "CREATE_ROLE", "role", result[0].id, req.ip]
    );

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error creating role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: error.message,
    });
  }
};

/**
 * Update role (only custom roles)
 */
export const updateRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if role exists and is not system role
    const roleCheck = await query(
      "SELECT id, is_system FROM roles WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    if (roleCheck[0].is_system) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify system roles",
      });
    }

    // Update role (partial — omitted fields keep their current value)
    const result = await query(
      `UPDATE roles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, name, description, is_system, created_at, updated_at`,
      [name || null, description || null, id]
    );

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "UPDATE_ROLE",
        "role",
        id,
        JSON.stringify({ name, description }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: "Role updated successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("Error updating role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: error.message,
    });
  }
};

/**
 * Delete role (only custom roles, must have no users)
 */
export const deleteRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if role exists and is not system role
    const roleCheck = await query(
      "SELECT id, is_system FROM roles WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    if (roleCheck[0].is_system) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete system roles",
      });
    }

    // Check if any users have this role
    const userCount = await query(
      "SELECT COUNT(*) as count FROM users WHERE role_id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (parseInt(userCount[0].count) > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete role with active users",
      });
    }

    // Soft delete role
    await query(
      "UPDATE roles SET deleted_at = NOW() WHERE id = $1",
      [id]
    );

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "DELETE_ROLE", "role", id, req.ip]
    );

    res.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete role",
      error: error.message,
    });
  }
};

/**
 * Get all permissions
 */
export const getPermissions = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, description, category
       FROM permissions
       WHERE deleted_at IS NULL
       ORDER BY category, name`
    );

    // Group by category
    const grouped = result.reduce((acc: any, perm: any) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push({
        id: perm.id,
        name: perm.name,
        description: perm.description,
      });
      return acc;
    }, {});

    res.json({ success: true, data: grouped });
  } catch (error: any) {
    console.error("Error getting permissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get permissions",
      error: error.message,
    });
  }
};

/**
 * Update role permissions
 */
export const updateRolePermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permission_ids = [] } = req.body;

    // Check if role exists
    const roleCheck = await query(
      "SELECT id, name, is_system FROM roles WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (roleCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // super_admin must always retain full access; its permissions are not editable.
    if (roleCheck[0].name === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "The super_admin role always has full access and cannot be modified",
      });
    }

    // Delete existing permissions
    await query("DELETE FROM role_permissions WHERE role_id = $1", [id]);

    // Insert new permissions
    if (permission_ids.length > 0) {
      const values = permission_ids
        .map((pid: string, idx: number) => `($1, $${idx + 2})`)
        .join(",");

      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
        [id, ...permission_ids]
      );
    }

    // Log audit event
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "UPDATE_ROLE_PERMISSIONS",
        "role",
        id,
        JSON.stringify({ permission_count: permission_ids.length }),
        req.ip,
      ]
    );

    // Permissions changed → drop the RBAC cache so enforcement updates immediately.
    invalidateRbacCache();

    res.json({
      success: true,
      message: "Permissions updated successfully",
      permissions_count: permission_ids.length,
    });
  } catch (error: any) {
    console.error("Error updating role permissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update permissions",
      error: error.message,
    });
  }
};
