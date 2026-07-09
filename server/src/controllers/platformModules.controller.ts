import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import * as modulesService from "../services/platformModules.service.js";

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ── SuperAdmin: module catalog ───────────────────────────────────────────────

export async function listModules(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const data = await modulesService.listModules(status);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getFeatureCatalog(_req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    res.json({ success: true, data: modulesService.getFeatureCatalog() });
  } catch (e) {
    next(e);
  }
}

export async function getModule(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await modulesService.getModuleById(getParam(req.params.id));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function createModule(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const { name, description, status, features, key, module_type, is_default, sort_order, icon } =
      req.body;
    const data = await modulesService.createModule({
      name,
      description,
      status,
      features,
      key,
      module_type,
      is_default,
      sort_order,
      icon,
    });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function updateModule(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await modulesService.updateModule(getParam(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function deleteModule(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    await modulesService.deleteModule(getParam(req.params.id));
    res.json({ success: true, message: "Module archived" });
  } catch (e) {
    next(e);
  }
}

// ── SuperAdmin: college assignments ─────────────────────────────────────────

export async function getCollegeModules(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await modulesService.getCollegeModuleAssignments(getParam(req.params.id));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function setCollegeModules(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const { assignments } = req.body as {
      assignments: { module_id: string; enabled: boolean }[];
    };
    const data = await modulesService.setCollegeModuleAssignments(
      getParam(req.params.id),
      assignments ?? [],
      req.user?.userId
    );
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function applyCollegeModuleDefaults(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const data = await modulesService.assignDefaultModulesToCollege(
      getParam(req.params.id),
      req.user?.userId
    );
    res.json({ success: true, data, message: "Default modules applied" });
  } catch (e) {
    next(e);
  }
}

// ── College / Student portals: enabled features ─────────────────────────────

export async function getCollegePortalFeatures(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      res.json({
        success: true,
        data: {
          features: modulesService.getFeatureCatalog().map((f) => f.key),
          modules: [],
        },
      });
      return;
    }
    const [features, modules] = await Promise.all([
      modulesService.getEnabledFeaturesForCollege(collegeId),
      modulesService.getEnabledLmsModulesForCollege(collegeId),
    ]);
    res.json({ success: true, data: { features, modules } });
  } catch (e) {
    next(e);
  }
}

/** Real content for an LMS module group (courses, practice topics, progress). */
export async function getLmsModuleContent(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const user = req.user!;
    const data = await modulesService.getLmsModuleContent(getParam(req.params.moduleKey), {
      // Super admins have no college — they see all platform-wide content.
      collegeId: user.college_id ?? null,
      studentId: user.role === "student" ? user.userId : null,
    });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getStudentPortalFeatures(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const collegeId = req.user?.college_id;
    const [features, modules] = await Promise.all([
      modulesService.getEnabledFeaturesForStudent(collegeId),
      collegeId
        ? modulesService.getEnabledLmsModulesForCollege(collegeId)
        : Promise.resolve([]),
    ]);
    res.json({ success: true, data: { features, modules } });
  } catch (e) {
    next(e);
  }
}
