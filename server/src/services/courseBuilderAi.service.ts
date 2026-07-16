/**
 * AI Course Builder — propose placement-prep course outlines and commit as drafts.
 * Assembles from Knowledge Library suggestions; does not author new questions/lessons.
 */
import { z } from "zod";
import { env } from "../config/env.js";
import { query, queryOne } from "../config/database.js";
import { generateJSON } from "./ai.service.js";
import { logAiUsage } from "./aiUsage.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { filterQuestions } from "./questionBank.service.js";
import {
  attachModuleAsset,
  updateAssessmentConfig,
  type ModuleAssetRole,
} from "./courseBuilder.service.js";

export const PHASE1_CATEGORIES = [
  "aptitude",
  "reasoning",
  "python_coding",
  "java_coding",
  "data_science",
] as const;

export type Phase1Category = (typeof PHASE1_CATEGORIES)[number];

const TEMPLATE_MODULES: Record<Phase1Category, string[]> = {
  aptitude: ["Numbers", "Percentages", "Profit & Loss", "Time & Work", "Data Interpretation"],
  reasoning: ["Series", "Coding-Decoding", "Syllogism", "Blood Relations", "Puzzles"],
  python_coding: ["Introduction", "Variables", "Loops", "Functions", "OOP", "Projects"],
  java_coding: ["Introduction", "OOP Basics", "Collections", "Exceptions", "Projects"],
  data_science: ["AI Fundamentals", "Python for ML", "Supervised Learning", "Evaluation", "Projects"],
};

const DOMAIN_LABELS: Record<Phase1Category, string> = {
  aptitude: "Aptitude",
  reasoning: "Logical Reasoning",
  python_coding: "Python Programming",
  java_coding: "Java Programming",
  data_science: "AI / ML Fundamentals",
};

const suggestedAssetSchema = z.object({
  asset_type: z.enum([
    "question",
    "coding_challenge",
    "flashcard",
    "content",
    "lesson",
    "voice_lesson",
  ]),
  asset_id: z.string().uuid(),
  role: z.enum(["lesson", "practice", "coding", "assessment", "resource", "voice"]),
  title: z.string(),
  selected: z.boolean().default(true),
});

const moduleOutlineSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  objectives: z.array(z.string()).optional().default([]),
  suggested_assets: z.array(suggestedAssetSchema).optional().default([]),
});

export const courseOutlineSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.enum(PHASE1_CATEGORIES),
  subject: z.string().optional().default(""),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  estimated_hours: z.number().optional().default(20),
  learning_objectives: z.array(z.string()).optional().default([]),
  passing_percent: z.number().min(1).max(100).optional().default(60),
  attempts: z.number().int().min(1).optional().default(3),
  modules: z.array(moduleOutlineSchema).min(1),
  source: z.enum(["ai", "template"]).optional().default("ai"),
});

export type CourseOutline = z.infer<typeof courseOutlineSchema>;
export type SuggestedAsset = z.infer<typeof suggestedAssetSchema>;

const llmOutlineSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.enum(PHASE1_CATEGORIES),
  subject: z.string().optional().default(""),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  estimated_hours: z.number().optional().default(20),
  learning_objectives: z.array(z.string()).optional().default([]),
  passing_percent: z.number().optional().default(60),
  attempts: z.number().optional().default(3),
  modules: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional().default(""),
        objectives: z.array(z.string()).optional().default([]),
      })
    )
    .min(1)
    .max(12),
});

function inferCategory(prompt: string, hint?: string): Phase1Category {
  if (hint && (PHASE1_CATEGORIES as readonly string[]).includes(hint)) {
    return hint as Phase1Category;
  }
  const p = prompt.toLowerCase();
  if (/\bjava\b/.test(p)) return "java_coding";
  if (/\bpython\b/.test(p)) return "python_coding";
  if (/\b(ai|ml|machine learning|data science)\b/.test(p)) return "data_science";
  if (/\b(reason|logical|puzzle|syllog)\b/.test(p)) return "reasoning";
  if (/\b(aptitude|quant|percentage|profit)\b/.test(p)) return "aptitude";
  return "python_coding";
}

function inferDifficulty(prompt: string, hint?: string): "beginner" | "intermediate" | "advanced" {
  if (hint === "beginner" || hint === "intermediate" || hint === "advanced") return hint;
  const p = prompt.toLowerCase();
  if (/\b(advanced|expert)\b/.test(p)) return "advanced";
  if (/\b(intermediate|mid)\b/.test(p)) return "intermediate";
  return "beginner";
}

function templateOutline(prompt: string, category: Phase1Category, difficulty: CourseOutline["difficulty"]): CourseOutline {
  const label = DOMAIN_LABELS[category];
  const modules = TEMPLATE_MODULES[category].map((title) => ({
    title,
    description: `${title} for ${label}`,
    objectives: [`Understand ${title}`, `Practice ${title} problems`],
    suggested_assets: [] as SuggestedAsset[],
  }));

  return courseOutlineSchema.parse({
    title: prompt.trim().slice(0, 120) || `${label} — ${difficulty}`,
    description: `AI/template outline for ${label} placement preparation (${difficulty}). Review suggested Knowledge Library assets before publishing.`,
    category,
    subject: label,
    difficulty,
    estimated_hours: difficulty === "beginner" ? 16 : difficulty === "intermediate" ? 24 : 32,
    learning_objectives: [
      `Build core ${label} skills for campus placement`,
      "Practice with bank questions and coding challenges",
      "Complete module assessments at the course pass mark",
    ],
    passing_percent: 60,
    attempts: 3,
    modules,
    source: "template",
  });
}

async function enrichModuleAssets(
  moduleTitle: string,
  category: Phase1Category
): Promise<SuggestedAsset[]> {
  const out: SuggestedAsset[] = [];
  const search = moduleTitle.replace(/&/g, " ").trim();

  const practice = await filterQuestions({
    category,
    status: "published",
    search: search.length > 2 ? search : undefined,
    limit: 4,
    offset: 0,
  });
  let practiceRows = (practice.rows || []) as Array<{ id: string; question_text: string; type: string }>;
  if (practiceRows.length < 2) {
    const fallback = await filterQuestions({
      category,
      status: "published",
      limit: 4,
      offset: 0,
    });
    practiceRows = (fallback.rows || []) as typeof practiceRows;
  }

  for (const q of practiceRows.filter((r) => r.type !== "coding_challenge").slice(0, 3)) {
    out.push({
      asset_type: "question",
      asset_id: q.id,
      role: "practice",
      title: (q.question_text || "Question").slice(0, 140),
      selected: true,
    });
  }

  const coding = await filterQuestions({
    category,
    type: "coding_challenge",
    status: "published",
    limit: 2,
    offset: 0,
  });
  for (const q of ((coding.rows || []) as Array<{ id: string; question_text: string }>).slice(0, 2)) {
    out.push({
      asset_type: "coding_challenge",
      asset_id: q.id,
      role: "coding",
      title: (q.question_text || "Coding challenge").slice(0, 140),
      selected: true,
    });
  }

  // One assessment candidate from remaining practice pool
  const assessPool = practiceRows.filter((r) => r.type !== "coding_challenge");
  if (assessPool[0]) {
    out.push({
      asset_type: "question",
      asset_id: assessPool[0].id,
      role: "assessment",
      title: (assessPool[0].question_text || "Assessment").slice(0, 140),
      selected: true,
    });
  }

  // Flashcards (optional)
  try {
    const cards = await query<{ id: string; front: string }>(
      `SELECT id, front FROM flashcards
       WHERE ($1::text IS NULL OR category ILIKE '%' || $1 || '%' OR front ILIKE '%' || COALESCE($2, '') || '%')
       ORDER BY created_at DESC
       LIMIT 2`,
      [category, search.slice(0, 40) || null]
    );
    for (const c of cards) {
      out.push({
        asset_type: "flashcard",
        asset_id: c.id,
        role: "practice",
        title: (c.front || "Flashcard").slice(0, 140),
        selected: true,
      });
    }
  } catch {
    /* flashcards table may vary */
  }

  // Dedupe by asset_id+role
  const seen = new Set<string>();
  return out.filter((a) => {
    const k = `${a.asset_type}:${a.asset_id}:${a.role}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function enrichOutline(outline: CourseOutline): Promise<CourseOutline> {
  const modules = [];
  for (const mod of outline.modules) {
    const suggested_assets = await enrichModuleAssets(mod.title, outline.category);
    modules.push({ ...mod, suggested_assets });
  }
  return courseOutlineSchema.parse({ ...outline, modules });
}

export interface Phase1TemplateMeta {
  id: string;
  category: Phase1Category;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  module_titles: string[];
  estimated_hours: number;
}

export function listPhase1Templates(): Phase1TemplateMeta[] {
  return PHASE1_CATEGORIES.map((category) => {
    const label = DOMAIN_LABELS[category];
    const modules = TEMPLATE_MODULES[category];
    return {
      id: `phase1-${category}`,
      category,
      title: `${label} — Placement Prep`,
      description: `Phase-1 skeleton for ${label}: ${modules.length} modules ready to assemble from the Knowledge Library.`,
      difficulty: "beginner" as const,
      module_titles: modules,
      estimated_hours: 16,
    };
  });
}

export async function instantiateTemplate(input: {
  templateId: string;
  userId: string;
  title?: string;
  difficulty?: CourseOutline["difficulty"];
}): Promise<{ courseId: string; modulesCreated: number; assetsAttached: number }> {
  const category = input.templateId.replace(/^phase1-/, "") as Phase1Category;
  if (!(PHASE1_CATEGORIES as readonly string[]).includes(category)) {
    throw new AppError("Unknown template", 404);
  }
  const label = DOMAIN_LABELS[category];
  const difficulty = input.difficulty || "beginner";
  const title =
    (input.title || "").trim() || `${label} — Placement Prep (${difficulty})`;
  let outline = templateOutline(title, category, difficulty);
  outline = await enrichOutline(outline);
  return commitCourseOutline({ outline, userId: input.userId });
}

export async function generateCourseOutline(input: {
  prompt: string;
  category?: string;
  difficulty?: string;
  userId?: string | null;
}): Promise<CourseOutline> {
  const prompt = (input.prompt || "").trim();
  if (prompt.length < 8) {
    throw new AppError("Describe the course in at least a short sentence.", 400);
  }

  const category = inferCategory(prompt, input.category);
  const difficulty = inferDifficulty(prompt, input.difficulty);

  let outline: CourseOutline;

  if (!env.ANTHROPIC_API_KEY) {
    outline = templateOutline(prompt, category, difficulty);
  } else {
    try {
      const raw = await generateJSON<unknown>(
        `Admin request: """${prompt}"""

Build a placement-preparation course for GradLogic Phase-1 domains only.
Allowed categories: aptitude, reasoning, python_coding, java_coding, data_science.
Prefer category "${category}" and difficulty "${difficulty}" unless the request clearly differs.

Respond with ONLY JSON matching:
{
  "title": string,
  "description": string,
  "category": one of the allowed categories,
  "subject": string,
  "difficulty": "beginner"|"intermediate"|"advanced",
  "estimated_hours": number,
  "learning_objectives": string[],
  "passing_percent": number,
  "attempts": number,
  "modules": [{ "title": string, "description": string, "objectives": string[] }]
}

Rules:
- 4–8 modules, ordered for learning progression
- Do NOT invent question text or URLs — structure only
- Modules should map to teachable topics (e.g. Variables, Loops, Functions)`,
        {
          system:
            "You are the GradLogic Course Builder AI. Propose course structure only. Respond with ONLY a JSON object.",
          riskLevel: "draft",
          maxTokens: 4096,
        }
      );

      const { requiresReview: _r, ...body } = raw as Record<string, unknown> & {
        requiresReview?: boolean;
      };
      const parsed = llmOutlineSchema.parse(body);
      outline = courseOutlineSchema.parse({ ...parsed, source: "ai" });
    } catch (err) {
      // Fall back to templates so admins can still review + assemble KL assets
      outline = templateOutline(prompt, category, difficulty);
      outline.description =
        `${outline.description} (AI unavailable — using Phase-1 template: ${(err as Error).message?.slice(0, 120) || "error"})`;
    }
  }

  logAiUsage("course_builder:ai_outline", input.userId || null);
  return enrichOutline(outline);
}

export async function commitCourseOutline(input: {
  outline: CourseOutline;
  userId: string;
}): Promise<{ courseId: string; modulesCreated: number; assetsAttached: number }> {
  const outline = courseOutlineSchema.parse(input.outline);

  const course = await queryOne<{ id: string }>(
    `INSERT INTO courses (
       title, description, category, difficulty, duration_hours,
       language, subject, estimated_minutes, tags, created_by, status
     ) VALUES ($1,$2,$3,$4,$5,'en',$6,$7,$8,$9,'draft')
     RETURNING id`,
    [
      outline.title,
      outline.description || null,
      outline.category,
      outline.difficulty,
      outline.estimated_hours || null,
      outline.subject || DOMAIN_LABELS[outline.category],
      outline.estimated_hours ? Math.round(outline.estimated_hours * 60) : null,
      ["course-builder", "phase-1", "ai-outline", outline.source || "ai"],
      input.userId,
    ]
  );
  if (!course) throw new AppError("Failed to create course", 500);

  let modulesCreated = 0;
  let assetsAttached = 0;

  for (let i = 0; i < outline.modules.length; i++) {
    const mod = outline.modules[i];
    const row = await queryOne<{ id: string }>(
      `INSERT INTO course_modules (course_id, title, description, sort_order)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [course.id, mod.title, mod.description || null, i]
    );
    if (!row) continue;
    modulesCreated += 1;

    const selected = (mod.suggested_assets || []).filter((a) => a.selected !== false);
    for (let j = 0; j < selected.length; j++) {
      const a = selected[j];
      try {
        await attachModuleAsset({
          moduleId: row.id,
          assetType: a.asset_type,
          assetId: a.asset_id,
          role: a.role as ModuleAssetRole,
          sortOrder: j,
          meta: {
            title: a.title,
            ...(a.role === "assessment" ? { assessment_kind: "quiz" } : {}),
            from_ai_outline: true,
          },
        });
        assetsAttached += 1;
      } catch {
        /* skip invalid / duplicate asset refs */
      }
    }
  }

  await query(
    `UPDATE courses SET total_modules = (
       SELECT COUNT(*) FROM course_modules WHERE course_id = $1
     ), updated_at = NOW() WHERE id = $1`,
    [course.id]
  );

  await updateAssessmentConfig(course.id, {
    passing_percent: outline.passing_percent || 60,
    attempts: outline.attempts || 3,
    min_practice_per_module: 2,
    require_assessment: true,
  });

  logAiUsage("course_builder:ai_commit", input.userId);

  return { courseId: course.id, modulesCreated, assetsAttached };
}
