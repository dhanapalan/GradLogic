import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as ctrl from "../controllers/sessions.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", ctrl.listSessions);
router.delete("/all", ctrl.revokeAllSessions);
router.delete("/:id", ctrl.revokeSession);

export default router;
