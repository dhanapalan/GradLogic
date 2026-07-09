import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import * as usersController from "../controllers/users.controller.js";

const router = Router();

/**
 * List all users with filtering, search, and pagination
 * GET /api/superadmin/users?page=1&limit=50&search=john&role=admin&status=active
 */
router.get(
  "/",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_view"),
  usersController.listUsers
);

/**
 * Search users with autocomplete
 * GET /api/superadmin/users/search?q=john
 */
router.get(
  "/search",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_view"),
  usersController.searchUsers
);

/**
 * Create user (invite)
 * POST /api/superadmin/users
 */
router.post(
  "/",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.createUser
);

/**
 * Get single user details
 * GET /api/superadmin/users/:id
 */
router.get(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_view"),
  usersController.getUser
);

/**
 * Update user details
 * PUT /api/superadmin/users/:id
 */
router.put(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.updateUser
);

/**
 * Deactivate user (sets is_active=false, status=inactive)
 * DELETE /api/superadmin/users/:id
 */
router.delete(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.deleteUser
);

/**
 * Activate user
 * POST /api/superadmin/users/:id/activate
 */
router.post(
  "/:id/activate",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.activateUser
);

/**
 * Suspend user account
 * POST /api/superadmin/users/:id/suspend
 */
router.post(
  "/:id/suspend",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.suspendUser
);

/**
 * Unsuspend user account
 * POST /api/superadmin/users/:id/unsuspend
 */
router.post(
  "/:id/unsuspend",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.unsuspendUser
);

/**
 * Bulk user operations
 * POST /api/superadmin/users/bulk-action
 * Body: { user_ids: [id1, id2], action: "suspend|delete|activate" }
 */
router.post(
  "/bulk-action",
  authenticate,
  authorize("super_admin"),
  requirePermission("users_manage"),
  usersController.bulkUserAction
);

export default router;
