import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

/**
 * All user management routes require Admin (super_admin) privileges only.
 * HR, Engineer, and CxO cannot manage users per RBAC policy.
 */
router.use(authenticate);
router.use(authorize("super_admin", "admin"));

router.get("/", userController.listUsers);
router.get("/companies", userController.listCompanies);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.put("/:id/role", userController.updateUserRole);
router.put("/:id/status", userController.updateUserStatus);
router.post("/:id/reset-password", userController.resetPassword);
router.put("/:id/password", userController.updatePassword);

export default router;
