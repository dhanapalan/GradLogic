import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import * as workflowsController from "../controllers/workflows.controller.js";

const router = Router();

// All routes require super_admin role
router.use(authenticate);
router.use(authorize("super_admin"));

// List workflows
router.get("/", requirePermission("workflows_view"), workflowsController.listWorkflows);

// Get workflow details
router.get("/:id", requirePermission("workflows_view"), workflowsController.getWorkflow);

// Create workflow
router.post("/", requirePermission("workflows_manage"), workflowsController.createWorkflow);

// Update workflow
router.put("/:id", requirePermission("workflows_manage"), workflowsController.updateWorkflow);

// Delete workflow
router.delete("/:id", requirePermission("workflows_manage"), workflowsController.deleteWorkflow);

// Update workflow steps
router.put("/:id/steps", requirePermission("workflows_manage"), workflowsController.updateWorkflowSteps);

export default router;
