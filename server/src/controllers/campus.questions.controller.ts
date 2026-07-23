import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { queryOne } from "../config/database.js";
import * as qb from "../services/collegeQuestionBank.service.js";

function getParamAsString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

async function resolveCollegeId(req: Request): Promise<string> {
  const user = req.user;
  if (!user) throw new AppError("Unauthorized", 401);
  if (user.college_id) return user.college_id;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM colleges WHERE legacy_user_id = $1`,
    [user.userId]
  );
  if (row?.id) return row.id;
  throw new AppError("Unauthorized: College context missing", 403);
}

function actor(req: Request) {
  return {
    id: req.user!.userId,
    role: req.user!.role,
    ip: typeof req.ip === "string" ? req.ip : undefined,
  };
}

/** GET /api/campus/questions/meta */
export async function getMeta(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: qb.metaCatalog() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/campus/questions/import-template */
export async function downloadImportTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    await resolveCollegeId(req);
    const buf = await qb.buildImportTemplateBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="college_question_import_template.xlsx"'
    );
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

/** GET /api/campus/questions */
export async function listQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const result = await qb.listQuestions(collegeId, {
      search: getParamAsString(req.query.search),
      category: getParamAsString(req.query.category),
      question_type: getParamAsString(req.query.question_type || req.query.type),
      difficulty: getParamAsString(req.query.difficulty),
      status: getParamAsString(req.query.status),
      page: parseInt(getParamAsString(req.query.page), 10) || 1,
      limit: parseInt(getParamAsString(req.query.limit), 10) || 20,
      sort: getParamAsString(req.query.sort) || "updated_at",
      order: getParamAsString(req.query.order) === "asc" ? "asc" : "desc",
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/campus/questions/:id */
export async function getQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await qb.getQuestion(collegeId, getParamAsString(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** POST /api/campus/questions */
export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await qb.createQuestion(collegeId, req.body, actor(req));
    res.status(201).json({ success: true, data, message: "Question created" });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/campus/questions/:id */
export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await qb.updateQuestion(
      collegeId,
      getParamAsString(req.params.id),
      req.body,
      actor(req)
    );
    res.json({ success: true, data, message: "Question updated" });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/campus/questions/:id/status */
export async function patchStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const status = getParamAsString(req.body?.status);
    if (!status) throw new AppError("status is required.", 400);
    const data = await qb.patchQuestionStatus(
      collegeId,
      getParamAsString(req.params.id),
      status,
      actor(req)
    );
    res.json({ success: true, data, message: `Status set to ${status}` });
  } catch (err) {
    next(err);
  }
}

/** POST /api/campus/questions/:id/duplicate */
export async function duplicateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await qb.duplicateQuestion(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.status(201).json({ success: true, data, message: "Question duplicated" });
  } catch (err) {
    next(err);
  }
}

/** POST /api/campus/questions/bulk-action — body: { ids: string[], action: "activate"|"deactivate"|"delete" } */
export async function bulkAction(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const action = getParamAsString(req.body?.action);
    const data = await qb.bulkUpdateQuestions(collegeId, ids, action, actor(req));
    res.json({
      success: true,
      data,
      message: `${data.summary.successful} of ${data.summary.total} question(s) updated`,
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/campus/questions/:id — soft delete only */
export async function softDeleteQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const data = await qb.softDeleteQuestion(
      collegeId,
      getParamAsString(req.params.id),
      actor(req)
    );
    res.json({ success: true, data, message: "Question deactivated (soft delete)" });
  } catch (err) {
    next(err);
  }
}

/** POST /api/campus/questions/ai-import — body: { questions: AiGeneratedQuestion[] } */
export async function aiImportQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!questions.length) throw new AppError("No questions to import.", 400);
    if (questions.length > 50) throw new AppError("Maximum 50 questions per AI import.", 400);
    const data = await qb.importAiGeneratedQuestions(collegeId, questions, actor(req));
    res.status(201).json({
      success: true,
      data,
      message: `Imported ${data.summary.successful} of ${data.summary.total} AI-generated question(s) as drafts`,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/campus/questions/import */
export async function importQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const collegeId = await resolveCollegeId(req);
    const file = req.file;
    if (!file?.buffer?.length) {
      throw new AppError("Excel file is required (field name: file).", 400);
    }
    const name = (file.originalname || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw new AppError("Upload an Excel file (.xlsx or .xls).", 400);
    }
    const data = await qb.importQuestionsFromExcel(collegeId, file.buffer, actor(req));
    res.status(201).json({
      success: true,
      data,
      message: `Imported ${data.summary.successful} of ${data.summary.total} question(s)`,
    });
  } catch (err) {
    next(err);
  }
}
