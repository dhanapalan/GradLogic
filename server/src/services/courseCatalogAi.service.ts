/**
 * Catalog AI insights — summary + recommendations for discovery/publish.
 * Template fallback when Anthropic is unavailable (mirrors Course Builder AI).
 */
import { z } from "zod";
import { env } from "../config/env.js";
import { generateJSON } from "./ai.service.js";
import { logAiUsage } from "./aiUsage.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { getCoursePreview } from "./courseCatalog.service.js";

const insightsSchema = z.object({
  summary: z.string().min(1),
  recommendations: z.array(z.string()).default([]),
  difficulty_analysis: z.string().optional().default(""),
  estimated_hours: z.number().optional().nullable(),
  missing_topics: z.array(z.string()).default([]),
  suggested_practice: z.array(z.string()).default([]),
  placement_readiness_score: z.number().min(0).max(100).optional().nullable(),
  skills: z.array(z.string()).default([]),
});

export type CatalogAiInsights = z.infer<typeof insightsSchema> & {
  source: "ai" | "template";
};

function templateInsights(preview: NonNullable<Awaited<ReturnType<typeof getCoursePreview>>>): CatalogAiInsights {
  const roleCounts = preview.role_counts;
  const missing: string[] = [];
  if ((roleCounts.lesson || 0) + (roleCounts.resource || 0) < 1) missing.push("Learning content / lessons");
  if ((roleCounts.practice || 0) < 3) missing.push("More practice questions");
  if ((roleCounts.coding || 0) < 1 && /coding|python|java|programming/i.test(preview.category)) {
    missing.push("Coding challenges");
  }
  if ((roleCounts.assessment || 0) < 1) missing.push("Module or course assessment");
  if ((roleCounts.voice || 0) < 1) missing.push("Voice lessons (optional)");

  const practiceHints = preview.modules.slice(0, 4).map((m) => `Add practice for “${m.title}” from Knowledge Library`);
  const score = Math.max(
    20,
    Math.min(
      95,
      40 +
        Math.min(30, (roleCounts.practice || 0) * 5) +
        Math.min(15, (roleCounts.coding || 0) * 5) +
        Math.min(15, (roleCounts.assessment || 0) * 10) +
        (preview.status === "published" ? 10 : 0)
    )
  );

  return insightsSchema.parse({
    summary: `${preview.title} is a ${preview.difficulty} ${preview.category.replace(/_/g, " ")} course with ${preview.modules.length} modules and ${preview.totals.assets} Knowledge Library mappings. ${
      missing.length
        ? `Before wide college rollout, consider closing: ${missing.slice(0, 3).join("; ")}.`
        : "Coverage looks solid for placement discovery."
    }`,
    recommendations: [
      "Preview modules with faculty before assigning batches",
      missing.length ? `Map: ${missing[0]}` : "Feature this course on the matching Placement Track",
      "Use Course Builder Review gates before publishing drafts",
      ...practiceHints.slice(0, 2),
    ].filter(Boolean),
    difficulty_analysis: `Listed as ${preview.difficulty}. Practice (${roleCounts.practice || 0}) and coding (${roleCounts.coding || 0}) items drive perceived hardness for students.`,
    estimated_hours:
      preview.duration_hours ||
      Math.max(8, preview.modules.length * 3),
    missing_topics: missing,
    suggested_practice: practiceHints,
    placement_readiness_score: score,
    skills: [
      preview.subject || preview.category.replace(/_/g, " "),
      ...preview.modules.slice(0, 5).map((m) => m.title),
    ],
  }) as CatalogAiInsights;
}

export async function generateCatalogInsights(
  courseId: string,
  userId?: string | null
): Promise<CatalogAiInsights> {
  const preview = await getCoursePreview(courseId);
  if (!preview) throw new AppError("Course not found", 404);

  const base = templateInsights(preview);

  if (!env.ANTHROPIC_API_KEY) {
    logAiUsage("course_catalog:ai_insights", userId || null);
    return { ...base, source: "template" };
  }

  try {
    const raw = await generateJSON<unknown>(
      `Course catalog insights for admin publish/discovery.

Title: ${preview.title}
Category: ${preview.category}
Difficulty: ${preview.difficulty}
Description: ${preview.description || "(none)"}
Modules: ${preview.modules.map((m) => m.title).join(", ") || "(none)"}
Role counts: ${JSON.stringify(preview.role_counts)}
Duration hours: ${preview.duration_hours ?? "unknown"}

Respond with ONLY JSON:
{
  "summary": string (2-4 sentences for catalog),
  "recommendations": string[],
  "difficulty_analysis": string,
  "estimated_hours": number,
  "missing_topics": string[],
  "suggested_practice": string[],
  "placement_readiness_score": number 0-100,
  "skills": string[]
}`,
      {
        system:
          "You are GradLogic Course Catalog AI. Insights only — do not invent questions. Respond with ONLY JSON.",
        riskLevel: "draft",
        maxTokens: 2048,
      }
    );
    const { requiresReview: _r, ...body } = raw as Record<string, unknown> & {
      requiresReview?: boolean;
    };
    const parsed = insightsSchema.parse(body);
    logAiUsage("course_catalog:ai_insights", userId || null);
    return { ...parsed, source: "ai" };
  } catch {
    logAiUsage("course_catalog:ai_insights", userId || null);
    return { ...base, source: "template" };
  }
}
