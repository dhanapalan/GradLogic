/**
 * AI Placement Coach (Phase 9) — combines a student's real signals (skills,
 * assessment scores, practice accuracy) into a placement-readiness report,
 * and generates company/role-aware interview prep.
 *
 * Inputs, and where each genuinely comes from:
 *   - Student        → JWT-derived studentId, never client-supplied.
 *   - Skills         → student_details.skills (self-reported free text).
 *   - Resume         → student_details.resume_url is a stored file link only;
 *                       no text-extraction pipeline exists for resumes in this
 *                       codebase, so "Resume" is used honestly as a presence/
 *                       completeness signal (uploaded or not), never as parsed
 *                       content the AI pretends to have read.
 *   - Assessment Scores → Assessment Hub drive_students (+ journey readiness)
 *                       blended with legacy marks_scored when present;
 *                       practice_attempts accuracy (adaptive-learning).
 *   - Target Company/Role → free-text request params; no company catalog or
 *                       company-specific test-pack feature exists in this
 *                       codebase, so this is a prompt-personalization input
 *                       only, not a database lookup.
 *
 * Outputs: Placement Readiness, Weak Skills (reused from adaptive.service.ts),
 * Interview Questions (AI-generated, validated JSON), Coding Challenges (real
 * question_bank rows, never fabricated), Study Plan (reuses
 * generateLearningPath from Phase 8), Voice Coaching (see
 * placementVoiceCoach.service.ts — reuses the Phase 6/7 streaming + speech
 * infrastructure with a new coaching persona).
 */

import { z } from "zod";
import { query, queryOne } from "../config/database.js";
import { generateJSON } from "./ai.service.js";
import { logger } from "../config/logger.js";
import { getWeakSkills, generateLearningPath, type SkillAccuracy, type LearningPath } from "./adaptive.service.js";
import type { QuestionBankRow } from "../types/index.js";

export interface StudentSignals {
  skills: string[];
  hasResume: boolean;
  examsTaken: number;
  examAverageScore: number | null; // stored as-is from marks_scored (assumed 0-100 scale)
  practiceAverageAccuracy: number | null; // 0-1, across categories with enough data
}

async function getStudentSignals(studentId: string): Promise<StudentSignals> {
  const profile = await queryOne<{ skills: string[] | null; resume_url: string | null }>(
    `SELECT skills, resume_url FROM student_details WHERE user_id = $1`,
    [studentId],
  );

  // Prefer Assessment Hub drive scores; fall back to legacy marks_scored exams
  const driveExam = await queryOne<{ exams_taken: number; avg_score: number | null }>(
    `SELECT COUNT(*)::int AS exams_taken,
            AVG(
              CASE
                WHEN art.total_marks IS NOT NULL AND art.total_marks > 0
                  THEN LEAST(100, GREATEST(0, (ds.score / art.total_marks) * 100))
                ELSE LEAST(100, GREATEST(0, ds.score))
              END
            )::float AS avg_score
     FROM drive_students ds
     JOIN assessment_drives ad ON ad.id = ds.drive_id
     LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
     WHERE ds.student_id = $1 AND ds.status = 'completed' AND ds.score IS NOT NULL`,
    [studentId],
  );

  const legacyExam = await queryOne<{ exams_taken: number; avg_score: number | null }>(
    `SELECT COUNT(*)::int AS exams_taken, AVG(final_score)::float AS avg_score
     FROM marks_scored WHERE student_id = $1`,
    [studentId],
  );

  const examsTaken = (driveExam?.exams_taken ?? 0) + (legacyExam?.exams_taken ?? 0);
  let examAverageScore: number | null = null;
  if ((driveExam?.exams_taken ?? 0) > 0 && driveExam?.avg_score != null) {
    examAverageScore = driveExam.avg_score;
  } else if (legacyExam?.avg_score != null) {
    examAverageScore = legacyExam.avg_score;
  }

  // Blend journey placement_readiness when present (Assessment Hub signal)
  const journey = await queryOne<{ avg: number | null }>(
    `SELECT AVG(placement_readiness)::float AS avg
     FROM student_journeys
     WHERE student_id = $1 AND status IN ('in_progress','completed','paused')`,
    [studentId],
  ).catch(() => null);

  if (journey?.avg != null && examAverageScore != null) {
    examAverageScore = 0.6 * examAverageScore + 0.4 * journey.avg;
  } else if (journey?.avg != null && examAverageScore == null) {
    examAverageScore = journey.avg;
  }

  const skillAccuracy = await getWeakSkills(studentId, 8);
  const withData = skillAccuracy.filter((s) => s.hasEnoughData);
  const practiceAverageAccuracy = withData.length
    ? withData.reduce((sum, s) => sum + s.accuracy, 0) / withData.length
    : null;

  return {
    skills: profile?.skills ?? [],
    hasResume: !!profile?.resume_url,
    examsTaken,
    examAverageScore,
    practiceAverageAccuracy,
  };
}

export interface ReadinessBreakdown {
  practiceAccuracyScore: number; // 0-100, contributes 40%
  examScore: number; // 0-100, contributes 30%
  profileCompletenessScore: number; // 0-100, contributes 30%
}

export interface PlacementReadiness {
  score: number; // 0-100
  label: "Getting started" | "Building readiness" | "Interview ready" | "Highly prepared";
  breakdown: ReadinessBreakdown;
  dataQuality: "low" | "moderate" | "good";
}

/**
 * A documented heuristic, not a certified metric: 40% recent practice
 * accuracy (Phase 8 data), 30% official exam average (marks_scored, assumed
 * already on a 0-100 scale — same convention as practice_sessions.score_percent
 * elsewhere in this schema), 30% profile completeness (resume uploaded +
 * skills listed). Missing components default to a neutral 50 rather than 0,
 * so a student who simply hasn't taken an exam yet isn't scored as if they
 * failed one.
 */
function computeReadiness(signals: StudentSignals): PlacementReadiness {
  const practiceAccuracyScore = signals.practiceAverageAccuracy !== null ? signals.practiceAverageAccuracy * 100 : 50;
  const examScore = signals.examAverageScore !== null ? Math.min(100, Math.max(0, signals.examAverageScore)) : 50;
  const profileCompletenessScore =
    (signals.hasResume ? 50 : 0) + (signals.skills.length > 0 ? 50 : 0);

  const score = Math.round(0.4 * practiceAccuracyScore + 0.3 * examScore + 0.3 * profileCompletenessScore);

  const label: PlacementReadiness["label"] =
    score < 40 ? "Getting started" : score < 65 ? "Building readiness" : score < 85 ? "Interview ready" : "Highly prepared";

  const signalsPresent = [signals.practiceAverageAccuracy !== null, signals.examAverageScore !== null, signals.hasResume].filter(Boolean).length;
  const dataQuality: PlacementReadiness["dataQuality"] = signalsPresent >= 3 ? "good" : signalsPresent >= 1 ? "moderate" : "low";

  return { score, label, breakdown: { practiceAccuracyScore: Math.round(practiceAccuracyScore), examScore: Math.round(examScore), profileCompletenessScore }, dataQuality };
}

// ── Interview Questions (AI-generated, scoped by weak skills + company/role) ──

const interviewQuestionSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(5),
        type: z.enum(["behavioral", "technical", "company_specific"]),
        focusSkill: z.string().optional(),
      }),
    )
    .min(1),
});
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>["questions"][number];

export async function generateInterviewQuestions(
  weakSkills: SkillAccuracy[],
  skills: string[],
  targetCompany?: string,
  targetRole?: string,
): Promise<InterviewQuestion[]> {
  const weakCategoryLabels = weakSkills.filter((s) => s.hasEnoughData || s.attempts === 0).slice(0, 3).map((s) => s.category.replace(/_/g, " "));
  const prompt = [
    "Generate a mixed set of 6 interview questions for a campus-placement candidate.",
    targetCompany ? `Target company: ${targetCompany}.` : "No specific target company given — keep questions generally applicable.",
    targetRole ? `Target role: ${targetRole}.` : "",
    skills.length ? `Candidate's self-reported skills: ${skills.join(", ")}.` : "",
    weakCategoryLabels.length ? `Areas the candidate needs more practice in: ${weakCategoryLabels.join(", ")} — include at least 2 technical questions probing these.` : "",
    'Include a mix of "behavioral", "technical", and (only if a target company was given) "company_specific" questions.',
    'Return JSON: {"questions": [{"question": string, "type": "behavioral"|"technical"|"company_specific", "focusSkill": string (optional)}]}.',
  ].filter(Boolean).join("\n");

  const result = await generateJSON<z.infer<typeof interviewQuestionSchema>>(prompt, {
    system: "You are a placement/interview coach. Respond with ONLY a JSON object matching the requested shape — no prose, no markdown.",
    riskLevel: "draft",
  });
  const parsed = interviewQuestionSchema.safeParse(result);
  if (!parsed.success) return [];
  return parsed.data.questions;
}

// ── Coding Challenges (real question_bank rows, never fabricated) ────────────

export interface CodingChallengeRef {
  id: string;
  question_text: string;
  category: string;
  difficulty_level: string;
  marks: number;
}

export async function getCodingChallenges(weakSkills: SkillAccuracy[], limit = 5): Promise<CodingChallengeRef[]> {
  const categories = weakSkills.map((s) => s.category);
  if (!categories.length) return [];
  const rows = await query<QuestionBankRow>(
    `SELECT * FROM question_bank
     WHERE type = 'coding_challenge' AND category::text = ANY($1::text[])
       AND is_active = TRUE AND status = 'published'
     ORDER BY RANDOM()
     LIMIT $2`,
    [categories, limit],
  );
  return rows.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    category: q.category,
    difficulty_level: q.difficulty_level,
    marks: q.marks,
  }));
}

// ── Combined report ───────────────────────────────────────────────────────────

export interface PlacementCoachReport {
  readiness: PlacementReadiness;
  weakSkills: SkillAccuracy[];
  interviewQuestions: InterviewQuestion[];
  codingChallenges: CodingChallengeRef[];
  studyPlan: LearningPath;
  skills: string[];
  hasResume: boolean;
}

export async function getPlacementCoachReport(
  studentId: string,
  targetCompany?: string,
  targetRole?: string,
): Promise<PlacementCoachReport> {
  const signals = await getStudentSignals(studentId);
  const readiness = computeReadiness(signals);
  const weakSkills = await getWeakSkills(studentId, 5);

  // Interview-question generation depends on the LLM being configured/reachable;
  // a failure there shouldn't take down the rest of the report (readiness,
  // weak skills, real coding challenges, and the study plan are all
  // DB-only and should still render).
  const [interviewQuestions, codingChallenges, studyPlan] = await Promise.all([
    generateInterviewQuestions(weakSkills, signals.skills, targetCompany, targetRole).catch((err) => {
      logger.warn("Placement Coach: interview question generation failed", { error: (err as Error).message });
      return [] as InterviewQuestion[];
    }),
    getCodingChallenges(weakSkills, 5),
    generateLearningPath(studentId, 5),
  ]);

  return {
    readiness,
    weakSkills,
    interviewQuestions,
    codingChallenges,
    studyPlan,
    skills: signals.skills,
    hasResume: signals.hasResume,
  };
}
