// =============================================================================
// TalentSecure AI — LLM Service (Assessment Generator)
// =============================================================================
// Claude calls go through ai.service.ts; Groq calls (drive question
// generation only) go through groq.service.ts. Never call either vendor
// SDK/fetch directly from feature code — always through one of those two.

import { generateJSON } from "./ai.service.js";
import * as groqService from "./groq.service.js";
import { logger } from "../config/logger.js";
import { AppError } from "../middleware/errorHandler.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategoryWeight {
  category: string;
  percentage: number;
}

export interface MCQQuestion {
  type: "mcq";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correctAnswer: number; // 0-based index
  explanation: string;
  marks: number;
}

export interface CodingChallenge {
  type: "coding";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  title: string;
  description: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  hiddenTestCases: { input: string; expectedOutput: string }[];
  starterCode: Record<string, string>; // language -> template
  marks: number;
  timeLimitMs: number;
  memoryLimitKb: number;
}

export type AssessmentQuestion = MCQQuestion | CodingChallenge;

export interface GeneratedAssessment {
  title: string;
  totalMarks: number;
  totalQuestions: number;
  categories: CategoryWeight[];
  questions: AssessmentQuestion[];
}

// ── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  categories: CategoryWeight[],
  totalQuestions: number,
  durationMinutes: number,
): string {
  const categoryBreakdown = categories
    .map((c) => {
      const count = Math.max(1, Math.round((c.percentage / 100) * totalQuestions));
      return `  - "${c.category}": ${c.percentage}% → ~${count} questions`;
    })
    .join("\n");

  return `You are an expert assessment designer for a technical hiring platform called TalentSecure AI.

Your task is to generate a **JSON array** of exam questions matching the exact percentage weights provided by the employer.

## EXAM CONSTRAINTS:
- Total questions: ${totalQuestions}
- Total duration: ${durationMinutes} minutes
- Average time per question: ${(durationMinutes / totalQuestions).toFixed(1)} minutes
- For coding challenges, allocate roughly 2–3× the average time since they require more thought.

## CATEGORY ALLOCATION:
${categoryBreakdown}

## RULES:
1. Generate exactly ${totalQuestions} questions total.
2. Each category's question count MUST match its percentage weight (rounded to the nearest integer).
3. Mix question types:
   - For "Programming" and "Data Structures" categories: include at least 1 coding challenge per category; the rest can be MCQs.
   - For "Reasoning", "Maths", and "Aptitude" categories: use only MCQs.
4. Difficulty mix: approximately 30% easy, 50% medium, 20% hard across the full set.
5. MCQ questions MUST have exactly 4 options.
6. Coding challenges MUST include:
   - A clear problem statement.
   - Constraints.
   - 1 sample test case (input/output).
   - 3 hidden test cases (input/output) for auto-grading.
   - Starter code templates for "python", "javascript", and "cpp".
7. Marks allocation: easy = 5, medium = 10, hard = 15.
8. For coding challenges set timeLimitMs = 5000 and memoryLimitKb = 262144.

## OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown, no explanation) with this schema:

{
  "title": "Auto-Generated Assessment",
  "totalMarks": <sum of all marks>,
  "totalQuestions": ${totalQuestions},
  "durationMinutes": ${durationMinutes},
  "questions": [
    {
      "type": "mcq",
      "category": "<category name>",
      "difficulty": "easy" | "medium" | "hard",
      "question": "<question text>",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": <0-3>,
      "explanation": "<brief explanation>",
      "marks": <5|10|15>
    },
    {
      "type": "coding",
      "category": "<category name>",
      "difficulty": "easy" | "medium" | "hard",
      "title": "<problem title>",
      "description": "<full problem description>",
      "constraints": "<constraints text>",
      "sampleInput": "<sample input>",
      "sampleOutput": "<sample output>",
      "hiddenTestCases": [
        { "input": "<input>", "expectedOutput": "<output>" }
      ],
      "starterCode": {
        "python": "<template>",
        "javascript": "<template>",
        "cpp": "<template>"
      },
      "marks": <5|10|15>,
      "timeLimitMs": 5000,
      "memoryLimitKb": 262144
    }
  ]
}`;
}

// ── OpenAI API Call ──────────────────────────────────────────────────────────

export async function generateAssessment(
  categories: CategoryWeight[],
  totalQuestions: number = 20,
  durationMinutes: number = 60,
): Promise<GeneratedAssessment> {
  const total = categories.reduce((sum, c) => sum + c.percentage, 0);
  if (Math.abs(total - 100) > 0.5) {
    throw new AppError(
      `Category percentages must sum to 100%. Current total: ${total}%`,
      400,
    );
  }

  const systemPrompt = buildSystemPrompt(categories, totalQuestions, durationMinutes);
  const userPrompt = `Generate a technical assessment with these category weights:\n${JSON.stringify(categories, null, 2)}\n\nTotal questions: ${totalQuestions}\nDuration: ${durationMinutes} minutes`;

  logger.info("Generating assessment via AI service", { categories, totalQuestions });

  try {
    const parsed = await generateJSON<GeneratedAssessment>(userPrompt, {
      system: systemPrompt,
      maxTokens: 8000,
      riskLevel: "draft", // question generation → goes to review queue before use
    });
    parsed.categories = categories;
    parsed.totalQuestions = parsed.questions.length;
    parsed.totalMarks = parsed.questions.reduce((s, q) => s + q.marks, 0);

    logger.info("Assessment generated successfully", {
      totalQuestions: parsed.totalQuestions,
      totalMarks: parsed.totalMarks,
    });

    return parsed;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error("LLM service error", { error: err.message });
    throw new AppError(`Failed to generate assessment: ${err.message}`, 500);
  }
}

// =============================================================================
// Dynamic Assessment Generator (POST /api/exams/generate-dynamic)
// =============================================================================

export interface DynamicWeight {
  category: string;   // e.g. "Aptitude", "Python Coding", "Reasoning"
  percentage: number; // 0-100, all must sum to 100
}

export interface DynamicMCQ {
  type: "mcq";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  options: string[];      // exactly 4 options
  correct_answer: number; // 0-based index into options[]
}

export interface DynamicCoding {
  type: "coding";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  hidden_test_cases: { input: string; expected_output: string }[];
}

export type DynamicQuestion = DynamicMCQ | DynamicCoding;

export interface DynamicAssessmentResult {
  total_questions: number;
  category_breakdown: { category: string; count: number; percentage: number }[];
  questions: DynamicQuestion[];
}

// ── Strict Recruiter System Prompt ──────────────────────────────────────────

function buildDynamicSystemPrompt(
  weights: DynamicWeight[],
  totalQuestions: number,
  durationMinutes: number,
): string {
  const breakdown = weights
    .map((w) => {
      const count = Math.max(1, Math.round((w.percentage / 100) * totalQuestions));
      return `  • "${w.category}": ${w.percentage}% → exactly ${count} question(s)`;
    })
    .join("\n");

  return `You are a world-class technical recruiter and assessment architect at TalentSecure AI, a Fortune-500 talent evaluation platform.

Your SOLE task is to generate brand-new, 100% original exam questions. Every question must be unique — never copy from publicly available question banks, textbooks, or coding platforms. Use creative, real-world scenarios.

════════════════════════════════════════════════════════════════
  EXAM PARAMETERS
════════════════════════════════════════════════════════════════
Total questions: ${totalQuestions}
Total duration: ${durationMinutes} minutes
Avg time per question: ~${(durationMinutes / totalQuestions).toFixed(1)} min
For coding questions allocate ~2–3× the average time.

════════════════════════════════════════════════════════════════
  CATEGORY WEIGHTS  (must be obeyed EXACTLY)
════════════════════════════════════════════════════════════════
${breakdown}

Total questions to produce: ${totalQuestions}
Total exam duration: ${durationMinutes} minutes

════════════════════════════════════════════════════════════════
  HARD RULES  (violating any rule makes the output INVALID)
════════════════════════════════════════════════════════════════
1. The number of questions per category MUST match the counts above.  Sum of all counts = ${totalQuestions}.
2. Identify whether each category is "knowledge/aptitude" or "coding":
   • If the category name contains words like "coding", "programming", "code", "DSA", "algorithm", or a language name (Python, Java, C++, JavaScript, Go, Rust, SQL, etc.) → produce CODING questions.
   • Otherwise → produce MCQ questions.
3. Difficulty distribution across the FULL set: ~30% easy, ~50% medium, ~20% hard.
4. MCQ rules:
   a. "options" must be an array of EXACTLY 4 distinct, plausible strings.
   b. "correct_answer" must be the 0-based index (0-3) of the correct option.
   c. DO NOT include any explanation or justification field.
5. Coding rules:
   a. "question_text" must contain a complete, self-contained problem statement including input/output format and constraints.
   b. "hidden_test_cases" must be an array of EXACTLY 4 objects, each with "input" (string) and "expected_output" (string).  Cover edge cases.
   c. DO NOT include options, correct_answer, sample I/O, starter code, or any field not listed below.
6. Every question object must have EXACTLY these fields and NO others:
   • type            — "mcq" | "coding"
   • category        — the exact category string from the weights
   • difficulty      — "easy" | "medium" | "hard"
   • question_text   — the full question / problem statement
   • options         — present ONLY when type = "mcq"
   • correct_answer  — present ONLY when type = "mcq"
   • hidden_test_cases — present ONLY when type = "coding"
7. Return ONLY a single valid JSON object. No markdown fences, no commentary, no trailing commas.

════════════════════════════════════════════════════════════════
  OUTPUT JSON SCHEMA
════════════════════════════════════════════════════════════════
{
  "total_questions": ${totalQuestions},
  "duration_minutes": ${durationMinutes},
  "category_breakdown": [
    { "category": "<name>", "count": <n>, "percentage": <p> }
  ],
  "questions": [
    // MCQ example:
    {
      "type": "mcq",
      "category": "<exact category>",
      "difficulty": "medium",
      "question_text": "...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 2
    },
    // Coding example:
    {
      "type": "coding",
      "category": "<exact category>",
      "difficulty": "hard",
      "question_text": "...",
      "hidden_test_cases": [
        { "input": "...", "expected_output": "..." },
        { "input": "...", "expected_output": "..." },
        { "input": "...", "expected_output": "..." },
        { "input": "...", "expected_output": "..." }
      ]
    }
  ]
}

Begin generating now. Output ONLY the JSON.`;
}

// ── Shared validation / normalization (both providers) ──────────────────────

function validateWeights(weights: DynamicWeight[]): void {
  const pctTotal = weights.reduce((s, w) => s + w.percentage, 0);
  if (Math.abs(pctTotal - 100) > 0.5) {
    throw new AppError(
      `Category percentages must sum to 100%. Current total: ${pctTotal}%`,
      400,
    );
  }
}

function normalizeDynamicAssessmentResult(
  weights: DynamicWeight[],
  parsed: DynamicAssessmentResult,
): DynamicAssessmentResult {
  if (!Array.isArray(parsed.questions)) {
    throw new AppError("LLM response missing 'questions' array", 502);
  }

  // Strip any rogue fields the LLM may have added, and drop MCQs whose
  // correct_answer isn't a valid index into their own options. Smaller
  // models are more prone to this than Claude at this batch scale, and an
  // out-of-range index would silently corrupt the stored answer key.
  const cleaned: DynamicQuestion[] = [];
  let droppedCount = 0;
  for (const q of parsed.questions) {
    if (q.type === "coding") {
      cleaned.push({
        type: q.type,
        category: q.category,
        difficulty: q.difficulty,
        question_text: q.question_text,
        hidden_test_cases: q.hidden_test_cases,
      });
      continue;
    }
    const optionsLen = Array.isArray(q.options) ? q.options.length : 0;
    if (
      typeof q.correct_answer !== "number" ||
      q.correct_answer < 0 ||
      q.correct_answer >= optionsLen
    ) {
      droppedCount++;
      continue;
    }
    cleaned.push({
      type: q.type,
      category: q.category,
      difficulty: q.difficulty,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
    });
  }
  if (droppedCount > 0) {
    logger.warn(`Dropped ${droppedCount} MCQ question(s) with an out-of-range correct_answer`);
  }
  parsed.questions = cleaned;

  // Rebuild breakdown from actual (post-filter) counts (trust but verify)
  const countMap = new Map<string, number>();
  for (const q of parsed.questions) {
    countMap.set(q.category, (countMap.get(q.category) ?? 0) + 1);
  }
  parsed.category_breakdown = weights.map((w) => ({
    category: w.category,
    count: countMap.get(w.category) ?? 0,
    percentage: w.percentage,
  }));
  parsed.total_questions = parsed.questions.length;

  return parsed;
}

// ── Claude Call ──────────────────────────────────────────────────────────────

export async function generateDynamicAssessment(
  weights: DynamicWeight[],
  totalQuestions: number,
  durationMinutes: number = 60,
): Promise<DynamicAssessmentResult> {
  validateWeights(weights);

  const systemPrompt = buildDynamicSystemPrompt(weights, totalQuestions, durationMinutes);
  const userPrompt = `Category weights:\n${JSON.stringify(weights, null, 2)}\n\nTotal questions: ${totalQuestions}\nDuration: ${durationMinutes} minutes\n\nGenerate now.`;

  logger.info("Generating dynamic assessment via AI service", { weights, totalQuestions });

  try {
    const parsed = await generateJSON<DynamicAssessmentResult>(userPrompt, {
      system: systemPrompt,
      maxTokens: 16000,
      riskLevel: "draft",
    });

    const result = normalizeDynamicAssessmentResult(weights, parsed);

    logger.info("Dynamic assessment generated successfully", {
      totalQuestions: result.total_questions,
      categories: result.category_breakdown,
    });

    return result;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error("LLM service error (generate-dynamic)", { error: err.message });
    throw new AppError(`Failed to generate dynamic assessment: ${err.message}`, 500);
  }
}

// ── Groq Call (drive question generation only) ──────────────────────────────

export async function generateDynamicAssessmentViaGroq(
  weights: DynamicWeight[],
  totalQuestions: number,
  durationMinutes: number = 60,
): Promise<DynamicAssessmentResult> {
  validateWeights(weights);

  const systemPrompt = buildDynamicSystemPrompt(weights, totalQuestions, durationMinutes);
  const userPrompt = `Category weights:\n${JSON.stringify(weights, null, 2)}\n\nTotal questions: ${totalQuestions}\nDuration: ${durationMinutes} minutes\n\nGenerate now.`;

  logger.info("Generating dynamic assessment via Groq", { weights, totalQuestions });

  try {
    const parsed = await groqService.generateJSON<DynamicAssessmentResult>(userPrompt, {
      system: systemPrompt,
      maxTokens: 8000,
    });

    const result = normalizeDynamicAssessmentResult(weights, parsed);

    logger.info("Dynamic assessment generated successfully via Groq", {
      totalQuestions: result.total_questions,
      categories: result.category_breakdown,
    });

    return result;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error("LLM service error (generate-dynamic via Groq)", { error: err.message });
    throw new AppError(`Failed to generate dynamic assessment via Groq: ${err.message}`, 500);
  }
}
