import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import * as modulesController from "../controllers/platformModules.controller.js";

const router = Router();

router.use(authenticate, authorize("super_admin"));

router.get("/catalog", requirePermission("modules_view"), modulesController.getFeatureCatalog);
router.get("/", requirePermission("modules_view"), modulesController.listModules);
router.post("/", requirePermission("modules_manage"), modulesController.createModule);
router.get("/:id", requirePermission("modules_view"), modulesController.getModule);
router.put("/:id", requirePermission("modules_manage"), modulesController.updateModule);
router.delete("/:id", requirePermission("modules_manage"), modulesController.deleteModule);

export default router;
