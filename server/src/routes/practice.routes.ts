// =============================================================================
// GradLogic — Practice Arena Routes
// Quiz sessions · Coding submissions · Skill stats
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import { executeCode, runTestCases } from "../services/codeExecution.service.js";
import { generate } from "../services/ai.service.js";
import { awardXP, checkAndAwardBadges, updateStreak, XP_VALUES } from "./gamification.routes.js";
import { PHASE1_BANK_CATEGORIES } from "../shared/phase1PlacementDomains.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

const PHASE1_CATEGORIES = PHASE1_BANK_CATEGORIES as readonly string[];
/** Sprint 8 Coding Assessments — Phase 1 languages only */
const CODING_LANGS = new Set(["python", "java"]);
const CODING_CATEGORIES = ["python_coding", "java_coding"] as const;

function normalizeTestCases(raw: unknown): Array<{
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}> {
  if (!Array.isArray(raw)) return [];
  return raw.map((tc: any) => ({
    input: String(tc?.input ?? tc?.stdin ?? ""),
    expectedOutput: String(tc?.expectedOutput ?? tc?.expected_output ?? tc?.output ?? ""),
    hidden: tc?.hidden === true || tc?.is_hidden === true,
  }));
}

function starterForLanguage(starter: unknown, language: string): string {
  if (!starter) return "";
  if (typeof starter === "string") return starter;
  if (typeof starter === "object" && starter !== null) {
    const map = starter as Record<string, string>;
    return map[language] || map.python || map.java || Object.values(map)[0] || "";
  }
  return "";
}

function assertCodingLanguage(language: string): string {
  const lang = (language || "").toLowerCase().trim();
  if (!CODING_LANGS.has(lang)) {
    const err: any = new Error("Only Python and Java are supported for Coding Assessments");
    err.status = 400;
    throw err;
  }
  return lang;
}

// =============================================================================
// QUIZ PRACTICE
// =============================================================================

/**
 * GET /api/practice/topics
 * Phase-1 Placement Preparation domains only.
 */
router.get("/topics", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT category AS topic,
             COUNT(*)::int AS total_questions,
             COUNT(*) FILTER (WHERE difficulty_level = 'easy')::int   AS easy,
             COUNT(*) FILTER (WHERE difficulty_level = 'medium')::int AS medium,
             COUNT(*) FILTER (WHERE difficulty_level = 'hard')::int   AS hard
      FROM question_bank
      WHERE is_active = TRUE
        AND category::text = ANY($1::text[])
      GROUP BY category
      ORDER BY
        CASE category::text
          WHEN 'aptitude' THEN 1
          WHEN 'reasoning' THEN 2
          WHEN 'python_coding' THEN 3
          WHEN 'java_coding' THEN 4
          WHEN 'data_science' THEN 5
          ELSE 99
        END
    `, [PHASE1_CATEGORIES]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/practice/daily-target
 * The student's daily practice goal (set by their college), how many practice
 * sessions they've completed today, and their current streak.
 */
router.get("/daily-target", async (req, res, next) => {
  try {
    const studentId = req.user!.userId;

    const [targetRow, todayRow, streakRow] = await Promise.all([
      queryOne<{ daily_practice_target: number }>(`
        SELECT COALESCE(c.daily_practice_target, 1)::int AS daily_practice_target
        FROM users u
        LEFT JOIN colleges c ON c.id = u.college_id
        WHERE u.id = $1
      `, [studentId]),
      queryOne<{ completed_today: number }>(`
        SELECT COUNT(*)::int AS completed_today
        FROM practice_sessions
        WHERE student_id = $1 AND status = 'completed'
          AND completed_at >= date_trunc('day', now())
      `, [studentId]),
      queryOne<{ current_streak: number; longest_streak: number; last_practice_date: string | null }>(`
        SELECT current_streak, longest_streak, last_practice_date
        FROM practice_streaks WHERE student_id = $1
      `, [studentId]),
    ]);

    const target = targetRow?.daily_practice_target ?? 1;
    const completedToday = todayRow?.completed_today ?? 0;

    res.json({
      success: true,
      data: {
        target,
        completed_today: completedToday,
        remaining: Math.max(0, target - completedToday),
        met: target > 0 && completedToday >= target,
        current_streak: streakRow?.current_streak ?? 0,
        longest_streak: streakRow?.longest_streak ?? 0,
        last_practice_date: streakRow?.last_practice_date ?? null,
      },
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/practice/sessions
 * Start a new practice session and get questions (Phase-1 topics; unlimited new sessions).
 * Body: session_type, topic, difficulty, question_count, retry_incorrect?, question_ids?
 */
router.post("/sessions", async (req, res, next) => {
  try {
    const {
      session_type = "quiz",  // quiz | coding
      topic,
      difficulty = "mixed",
      question_count = 10,
      retry_incorrect = false,
      question_ids,
    } = req.body;

    const studentId = req.user!.userId;

    if (topic && !PHASE1_CATEGORIES.includes(topic)) {
      return res.status(400).json({
        success: false,
        error: "Practice Sets support Phase-1 domains only (aptitude, reasoning, python_coding, java_coding, data_science)",
      });
    }

    let questions: any[] = [];

    // Retry incorrect: pull wrong answers from recent completed sessions
    if (retry_incorrect || (Array.isArray(question_ids) && question_ids.length > 0)) {
      if (Array.isArray(question_ids) && question_ids.length > 0) {
        questions = await query(`
          SELECT id, category, type, difficulty_level, question_text, options, marks, hint, explanation
          FROM question_bank
          WHERE is_active = TRUE
            AND id = ANY($1::uuid[])
            AND category::text = ANY($2::text[])
          LIMIT 30
        `, [question_ids, PHASE1_CATEGORIES]);
      } else {
        questions = await query(`
          SELECT DISTINCT ON (q.id)
                 q.id, q.category, q.type, q.difficulty_level, q.question_text, q.options, q.marks, q.hint, q.explanation
          FROM practice_attempts pa
          JOIN practice_sessions ps ON ps.id = pa.session_id
          JOIN question_bank q ON q.id = pa.question_id
          WHERE ps.student_id = $1
            AND pa.is_correct = FALSE
            AND q.is_active = TRUE
            AND q.category::text = ANY($2::text[])
            AND ($3::text IS NULL OR q.category::text = $3)
          ORDER BY q.id, pa.attempted_at DESC
          LIMIT $4
        `, [studentId, PHASE1_CATEGORIES, topic || null, Math.min(Number(question_count) || 10, 30)]);
      }
    } else {
      const params: any[] = [Math.min(Number(question_count) || 10, 30), PHASE1_CATEGORIES];
      let topicClause = "";
      let diffClause = "";
      if (topic) {
        params.push(topic);
        topicClause = `AND category::text = $${params.length}`;
      }
      if (difficulty && difficulty !== "mixed") {
        params.push(difficulty);
        diffClause = `AND difficulty_level::text = $${params.length}`;
      }
      const typeClause =
        session_type === "coding"
          ? "AND type::text IN ('coding','CODING')"
          : "AND type::text NOT IN ('coding','CODING')";

      questions = await query(`
        SELECT id, category, type, difficulty_level, question_text, options, marks, hint, explanation
        FROM question_bank
        WHERE is_active = TRUE
          AND category::text = ANY($2::text[])
          ${topicClause}
          ${diffClause}
          ${typeClause}
        ORDER BY RANDOM()
        LIMIT $1
      `, params);
    }

    if (!questions.length) {
      return res.status(400).json({
        success: false,
        error: retry_incorrect
          ? "No incorrect questions to retry yet. Complete a practice session first."
          : "No questions available for this topic.",
      });
    }

    const session = await queryOne(`
      INSERT INTO practice_sessions (student_id, session_type, topic, difficulty, total_questions)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      studentId,
      retry_incorrect ? "quiz_retry" : session_type,
      topic || null,
      difficulty,
      questions.length,
    ]);

    // Never leak correct_answer to the client before answer submit
    const safeQuestions = questions.map((q) => ({
      id: q.id,
      category: q.category,
      type: q.type,
      difficulty_level: q.difficulty_level,
      question_text: q.question_text,
      options: q.options,
      marks: q.marks,
      hint: q.hint || null,
    }));

    res.status(201).json({ success: true, data: { session, questions: safeQuestions } });
  } catch (err) { next(err); }
});

/**
 * POST /api/practice/sessions/:sessionId/answer
 * Submit an answer for a quiz question
 */
router.post("/sessions/:sessionId/answer", async (req, res, next) => {
  try {
    const { question_id, student_answer, time_spent_seconds, hint_used } = req.body;
    const sessionId = req.params.sessionId;

    // Verify session belongs to student
    const session = await queryOne(
      "SELECT * FROM practice_sessions WHERE id = $1 AND student_id = $2",
      [sessionId, req.user!.userId]
    );
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Get correct answer + AI explanation / hint text from bank
    const question = await queryOne(
      "SELECT correct_answer, explanation, hint, marks FROM question_bank WHERE id = $1",
      [question_id]
    );
    if (!question) return res.status(404).json({ error: "Question not found" });

    const isCorrect = (question as any).correct_answer?.toString() === student_answer?.toString();

    await queryOne(`
      INSERT INTO practice_attempts (session_id, question_id, student_answer, is_correct, time_spent_seconds, hint_used)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [sessionId, question_id, student_answer, isCorrect, time_spent_seconds || 0, hint_used ?? false]);

    res.json({
      success: true,
      data: {
        is_correct: isCorrect,
        correct_answer: (question as any).correct_answer,
        explanation: (question as any).explanation,
        hint: (question as any).hint,
      },
    });
  } catch (err) { next(err); }
});

/**
 * PUT /api/practice/sessions/:sessionId/complete
 * Mark session as complete and compute final score
 */
router.put("/sessions/:sessionId/complete", async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const studentId = req.user!.userId;

    const stats = await queryOne(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_correct)::int AS correct,
        SUM(time_spent_seconds)::int AS time_spent
      FROM practice_attempts
      WHERE session_id = $1
    `, [sessionId]);

    const total   = (stats as any)?.total || 0;
    const correct = (stats as any)?.correct || 0;
    const score   = total > 0 ? Math.round((correct / total) * 100 * 100) / 100 : 0;

    const session = await queryOne(`
      UPDATE practice_sessions SET
        correct_answers    = $1,
        score_percent      = $2,
        time_spent_seconds = $3,
        status             = 'completed',
        completed_at       = NOW()
      WHERE id = $4 AND student_id = $5
      RETURNING *
    `, [correct, score, (stats as any)?.time_spent || 0, sessionId, studentId]);

    // ── Award XP & badges ─────────────────────────────────────────────────────
    const xpToAward = XP_VALUES.practice_session_completed
      + (score >= 100 ? XP_VALUES.practice_perfect_score : score >= 90 ? XP_VALUES.practice_high_score : 0);

    await awardXP(studentId, xpToAward, "practice_session", "Practice session completed", sessionId);
    await updateStreak(studentId);

    // First practice badge (awarded once)
    const isFirstSession = (await queryOne(
      "SELECT id FROM practice_sessions WHERE student_id = $1 AND status = 'completed' AND id != $2 LIMIT 1",
      [studentId, sessionId]
    )) === null;
    if (isFirstSession) await checkAndAwardBadges(studentId, { triggerSlug: "first_practice", sourceId: sessionId });

    // Score-based badges
    await checkAndAwardBadges(studentId, { scorePercent: score, sourceId: sessionId });

    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

/**
 * GET /api/practice/sessions
 * List past practice sessions for the student
 */
router.get("/sessions", async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT * FROM practice_sessions
      WHERE student_id = $1
      ORDER BY started_at DESC
      LIMIT 50
    `, [req.user!.userId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// =============================================================================
// BOOKMARKS
// =============================================================================

/**
 * GET /api/practice/bookmarks
 */
router.get("/bookmarks", async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT b.id, b.question_id, b.created_at,
             q.category, q.difficulty_level, q.question_text, q.type
      FROM practice_bookmarks b
      JOIN question_bank q ON q.id = b.question_id
      WHERE b.student_id = $1
      ORDER BY b.created_at DESC
      LIMIT 100
    `, [req.user!.userId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/practice/bookmarks
 * Body: { question_id }
 */
router.post("/bookmarks", async (req, res, next) => {
  try {
    const { question_id } = req.body;
    if (!question_id) return res.status(400).json({ success: false, error: "question_id required" });

    const q = await queryOne<{ id: string; category: string }>(
      `SELECT id, category::text AS category FROM question_bank WHERE id = $1 AND is_active = TRUE`,
      [question_id],
    );
    if (!q) return res.status(404).json({ success: false, error: "Question not found" });
    if (!PHASE1_CATEGORIES.includes(q.category)) {
      return res.status(400).json({ success: false, error: "Only Phase-1 practice questions can be bookmarked" });
    }

    const row = await queryOne(`
      INSERT INTO practice_bookmarks (student_id, question_id)
      VALUES ($1, $2)
      ON CONFLICT (student_id, question_id) DO UPDATE SET created_at = NOW()
      RETURNING *
    `, [req.user!.userId, question_id]);

    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/practice/bookmarks/:questionId
 */
router.delete("/bookmarks/:questionId", async (req, res, next) => {
  try {
    await query(
      `DELETE FROM practice_bookmarks WHERE student_id = $1 AND question_id = $2`,
      [req.user!.userId, req.params.questionId],
    );
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

/**
 * GET /api/practice/incorrect
 * Recent incorrect question ids for Retry Incorrect.
 */
router.get("/incorrect", async (req, res, next) => {
  try {
    const topic = (req.query.topic as string) || null;
    const rows = await query(`
      SELECT DISTINCT ON (q.id)
             q.id, q.category, q.difficulty_level, q.question_text, pa.attempted_at
      FROM practice_attempts pa
      JOIN practice_sessions ps ON ps.id = pa.session_id
      JOIN question_bank q ON q.id = pa.question_id
      WHERE ps.student_id = $1
        AND pa.is_correct = FALSE
        AND q.is_active = TRUE
        AND q.category::text = ANY($2::text[])
        AND ($3::text IS NULL OR q.category::text = $3)
      ORDER BY q.id, pa.attempted_at DESC
      LIMIT 50
    `, [req.user!.userId, PHASE1_CATEGORIES, topic]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// =============================================================================
// CODING ASSESSMENTS (Knowledge Library coding_challenge · Python / Java)
// =============================================================================

/**
 * GET /api/practice/coding/problems
 * List coding problems from Knowledge Library (coding_challenge).
 */
router.get("/coding/problems", async (req, res, next) => {
  try {
    const { topic, difficulty, drive_id } = req.query as Record<string, string>;

    let rows;
    if (drive_id) {
      rows = await query(
        `
        SELECT DISTINCT qb.id, qb.category, qb.difficulty_level,
               qb.question_text AS title, qb.marks, qb.tags, qb.starter_code
        FROM question_bank qb
        JOIN question_collection_items qci ON qci.question_id = qb.id
        JOIN drive_source_collections dsc ON dsc.collection_id = qci.collection_id
        WHERE dsc.drive_id = $1
          AND qb.type = 'coding_challenge'
          AND qb.is_active = TRUE
          AND qb.category::text = ANY($2::text[])
          AND ($3::text IS NULL OR qb.difficulty_level::text = $3)
        ORDER BY qb.difficulty_level, qb.category
        `,
        [drive_id, CODING_CATEGORIES as unknown as string[], difficulty || null],
      );
    } else {
      rows = await query(
        `
        SELECT id, category, difficulty_level, question_text AS title,
               marks, tags, starter_code
        FROM question_bank
        WHERE type = 'coding_challenge'
          AND is_active = TRUE
          AND category::text = ANY($3::text[])
          AND ($1::text IS NULL OR category::text = $1)
          AND ($2::text IS NULL OR difficulty_level::text = $2)
        ORDER BY difficulty_level, category
        `,
        [topic || null, difficulty || null, CODING_CATEGORIES as unknown as string[]],
      );
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/practice/coding/problems/:id
 * Single problem — starter code + visible sample tests only (hidden stripped).
 */
router.get("/coding/problems/:id", async (req, res, next) => {
  try {
    const problem = await queryOne(
      `
      SELECT id, category, difficulty_level, question_text, question_text AS title,
             marks, tags, starter_code, test_cases, hint, explanation,
             time_limit_ms, memory_limit_kb
      FROM question_bank
      WHERE id = $1 AND type = 'coding_challenge' AND is_active = TRUE
        AND category::text = ANY($2::text[])
      `,
      [req.params.id, CODING_CATEGORIES as unknown as string[]],
    );

    if (!problem) return res.status(404).json({ error: "Problem not found" });

    const allCases = normalizeTestCases((problem as any).test_cases);
    const visible = allCases.filter((tc) => !tc.hidden);
    const { test_cases: _tc, hint, explanation, ...rest } = problem as any;

    res.json({
      success: true,
      data: {
        ...rest,
        sample_tests: visible.map(({ input, expectedOutput }) => ({ input, expectedOutput })),
        hidden_test_count: allCases.filter((tc) => tc.hidden).length,
        has_hint: !!hint,
        has_explanation: !!explanation,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/practice/coding/run
 * Run code against custom input (no grading). Python & Java only.
 */
router.post("/coding/run", async (req, res, next) => {
  try {
    const { source_code, language, stdin } = req.body;
    if (!source_code || !language) {
      return res.status(400).json({ error: "source_code and language required" });
    }
    const lang = assertCodingLanguage(language);
    const result = await executeCode({ sourceCode: source_code, language: lang, stdin });
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err?.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/practice/coding/submit
 * Grade against all Knowledge Library test cases (incl. hidden). Score = % passed.
 */
router.post("/coding/submit", async (req, res, next) => {
  try {
    const { question_id, source_code, language } = req.body;
    if (!question_id || !source_code || !language) {
      return res.status(400).json({ error: "question_id, source_code, and language required" });
    }
    const lang = assertCodingLanguage(language);

    const question = await queryOne(
      `SELECT test_cases, time_limit_ms, memory_limit_kb, category
       FROM question_bank
       WHERE id = $1 AND type = 'coding_challenge' AND is_active = TRUE`,
      [question_id],
    );
    if (!question) return res.status(404).json({ error: "Problem not found" });
    if (!(CODING_CATEGORIES as readonly string[]).includes((question as any).category)) {
      return res.status(400).json({ error: "Only Python and Java coding challenges are supported" });
    }

    const testCases = normalizeTestCases((question as any).test_cases);
    if (testCases.length === 0) {
      return res.status(400).json({ error: "Problem has no test cases configured" });
    }

    const gradeResult = await runTestCases(
      source_code,
      lang,
      testCases.map(({ input, expectedOutput }) => ({ input, expectedOutput })),
      (question as any).time_limit_ms || undefined,
      (question as any).memory_limit_kb || undefined,
    );

    const passed = gradeResult.passed;
    const total = gradeResult.totalTestCases;
    const score = gradeResult.score;
    const hasTLE = gradeResult.testResults.some(
      (r: any) => r.status === "Time Limit Exceeded" || r.error === "TLE",
    );
    const status =
      passed === total ? "accepted" : hasTLE ? "time_limit_exceeded" : "wrong_answer";

    const submission = await queryOne(
      `
      INSERT INTO coding_submissions
        (student_id, question_id, language, source_code, status, test_cases_passed, total_test_cases)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [req.user!.userId, question_id, lang, source_code, status, passed, total],
    );

    await awardXP(
      req.user!.userId,
      XP_VALUES.coding_submission,
      "coding_submission",
      "Coding submission",
      question_id,
    );
    if (status === "accepted") {
      await awardXP(
        req.user!.userId,
        XP_VALUES.coding_accepted,
        "coding_accepted",
        "Accepted coding solution",
        question_id,
      );
      const prevAccepted = await queryOne(
        "SELECT id FROM coding_submissions WHERE student_id = $1 AND status = 'accepted' AND question_id != $2 LIMIT 1",
        [req.user!.userId, question_id],
      );
      if (!prevAccepted) {
        await checkAndAwardBadges(req.user!.userId, {
          triggerSlug: "code_accepted",
          sourceId: question_id,
        });
      }
    }
    const prevSubmission = await queryOne(
      "SELECT id FROM coding_submissions WHERE student_id = $1 AND id != $2 LIMIT 1",
      [req.user!.userId, (submission as any).id],
    );
    if (!prevSubmission) {
      await checkAndAwardBadges(req.user!.userId, {
        triggerSlug: "first_code_submit",
        sourceId: question_id,
      });
    }

    // Redact hidden case I/O — students only see pass/fail index for hidden
    const safeResults = gradeResult.testResults.map((r, i) => {
      const hidden = testCases[i]?.hidden === true;
      if (!hidden) return { ...r, hidden: false };
      return {
        testCaseIndex: r.testCaseIndex,
        passed: r.passed,
        status: r.status,
        time: r.time,
        memory: r.memory,
        hidden: true,
        input: "[hidden]",
        expectedOutput: "[hidden]",
        actualOutput: null,
        error: r.passed ? null : r.error,
      };
    });

    res.json({
      success: true,
      data: {
        submission,
        test_results: safeResults,
        passed,
        total,
        score,
        status,
      },
    });
  } catch (err: any) {
    if (err?.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/practice/coding/submissions/:questionId
 */
router.get("/coding/submissions/:questionId", async (req, res, next) => {
  try {
    const rows = await query(
      `
      SELECT id, language, status, test_cases_passed, total_test_cases, submitted_at
      FROM coding_submissions
      WHERE student_id = $1 AND question_id = $2
      ORDER BY submitted_at DESC
      `,
      [req.user!.userId, req.params.questionId],
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/practice/coding/ai
 * AI code review | hint | explanation for Coding Assessments (practice risk).
 */
router.post("/coding/ai", async (req, res, next) => {
  try {
    const { mode, question_id, source_code, language } = req.body as {
      mode?: string;
      question_id?: string;
      source_code?: string;
      language?: string;
    };
    if (!mode || !["review", "hint", "explain"].includes(mode)) {
      return res.status(400).json({ error: "mode must be review | hint | explain" });
    }
    if (!question_id) return res.status(400).json({ error: "question_id required" });

    const lang = language ? assertCodingLanguage(language) : "python";
    const problem = await queryOne(
      `
      SELECT question_text, category, difficulty_level, hint, explanation, test_cases, starter_code
      FROM question_bank
      WHERE id = $1 AND type = 'coding_challenge' AND is_active = TRUE
      `,
      [question_id],
    );
    if (!problem) return res.status(404).json({ error: "Problem not found" });

    const bankHint = (problem as any).hint as string | null;
    const bankExplanation = (problem as any).explanation as string | null;

    // Prefer bank content for hint/explain when present (no LLM cost)
    if (mode === "hint" && bankHint) {
      return res.json({ success: true, data: { mode, text: bankHint, source: "bank" } });
    }
    if (mode === "explain" && bankExplanation && !source_code) {
      return res.json({
        success: true,
        data: { mode, text: bankExplanation, source: "bank" },
      });
    }

    const visibleSamples = normalizeTestCases((problem as any).test_cases)
      .filter((tc) => !tc.hidden)
      .slice(0, 2)
      .map((tc) => `Input:\n${tc.input}\nExpected:\n${tc.expectedOutput}`)
      .join("\n---\n");

    const systems: Record<string, string> = {
      review:
        "You are a coding mentor for campus placement. Review the student's Python/Java code. Be concise: strengths, bugs, complexity, 2–3 concrete fixes. Do not rewrite a full solution unless necessary.",
      hint:
        "You are a coding mentor. Give ONE progressive hint for the problem — nudge toward the approach without giving complete code or the final answer.",
      explain:
        "You are a coding mentor. Explain the standard approach for this problem in clear steps. Optionally show a short pseudocode sketch. Do not dump a full production solution unless the student already submitted working code.",
    };

    const userPrompt = [
      `Mode: ${mode}`,
      `Language: ${lang}`,
      `Category: ${(problem as any).category}`,
      `Difficulty: ${(problem as any).difficulty_level}`,
      `Problem:\n${(problem as any).question_text}`,
      visibleSamples ? `Sample tests:\n${visibleSamples}` : "",
      source_code ? `Student code:\n\`\`\`${lang}\n${source_code}\n\`\`\`` : "Student has not shared code yet.",
      starterForLanguage((problem as any).starter_code, lang)
        ? `Starter stub exists for ${lang}.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await generate(userPrompt, {
      system: systems[mode],
      maxTokens: 1200,
      riskLevel: "practice",
    });

    res.json({
      success: true,
      data: { mode, text: result.text, source: "ai" },
    });
  } catch (err: any) {
    if (err?.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// =============================================================================
// SKILL STATS
// =============================================================================

/**
 * GET /api/practice/stats
 * Overall practice stats for the student dashboard
 */
router.get("/stats", async (req, res, next) => {
  try {
    const studentId = req.user!.userId;

    const [sessionStats, codingStats, topicStats] = await Promise.all([
      queryOne(`
        SELECT
          COUNT(*)::int AS total_sessions,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_sessions,
          COALESCE(AVG(score_percent) FILTER (WHERE status = 'completed'), 0)::numeric(5,2) AS avg_score,
          COALESCE(SUM(time_spent_seconds), 0)::int AS total_time_seconds
        FROM practice_sessions
        WHERE student_id = $1
      `, [studentId]),

      queryOne(`
        SELECT
          COUNT(*)::int AS total_submissions,
          COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
          COUNT(DISTINCT question_id)::int AS unique_problems_solved
        FROM coding_submissions
        WHERE student_id = $1
      `, [studentId]),

      query(`
        SELECT ps.topic, COUNT(*)::int AS sessions,
               ROUND(AVG(score_percent),1)::numeric AS avg_score
        FROM practice_sessions ps
        WHERE student_id = $1 AND status = 'completed' AND topic IS NOT NULL
        GROUP BY ps.topic
        ORDER BY sessions DESC
        LIMIT 8
      `, [studentId]),
    ]);

    res.json({ success: true, data: { sessions: sessionStats, coding: codingStats, topics: topicStats } });
  } catch (err) { next(err); }
});

export default router;
