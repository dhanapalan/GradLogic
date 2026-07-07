// =============================================================================
// GradLogic — Practice Arena Routes
// Quiz sessions · Coding submissions · Skill stats
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import { executeCode, runTestCases } from "../services/codeExecution.service.js";
import { awardXP, checkAndAwardBadges, updateStreak, XP_VALUES } from "./gamification.routes.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

// =============================================================================
// QUIZ PRACTICE
// =============================================================================

/**
 * GET /api/practice/topics
 * Return available practice topics with question counts
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
      GROUP BY category
      ORDER BY category
    `);
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
 * Start a new practice session and get questions
 */
router.post("/sessions", async (req, res, next) => {
  try {
    const {
      session_type = "quiz",  // quiz | coding
      topic,
      difficulty = "mixed",
      question_count = 10,
    } = req.body;

    const studentId = req.user!.userId;

    // Fetch random questions
    // category / difficulty_level are enums — compare as text so literals from the
    // client don't get cast into the enum type (which throws on any non-label value).
    let difficultyFilter = "";
    if (difficulty !== "mixed") difficultyFilter = `AND difficulty_level::text = '${difficulty}'`;

    const topicFilter = topic ? `AND category::text = '${topic}'` : "";
    // `type` is an enum — cast to text so a non-enum literal like 'coding' doesn't
    // trigger "invalid input value for enum question_type".
    const typeFilter  = session_type === "coding" ? "AND type::text IN ('coding','CODING')" : "AND type::text NOT IN ('coding','CODING')";

    const questions = await query(`
      SELECT id, category, type, difficulty_level, question_text, options, marks
      FROM question_bank
      WHERE is_active = TRUE
        ${topicFilter}
        ${difficultyFilter}
        ${typeFilter}
      ORDER BY RANDOM()
      LIMIT $1
    `, [question_count]);

    // Create session record
    const session = await queryOne(`
      INSERT INTO practice_sessions (student_id, session_type, topic, difficulty, total_questions)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [studentId, session_type, topic || null, difficulty, questions.length]);

    res.status(201).json({ success: true, data: { session, questions } });
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

    // Get correct answer
    const question = await queryOne(
      "SELECT correct_answer, explanation, marks FROM question_bank WHERE id = $1",
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
// CODING PRACTICE
// =============================================================================

/**
 * GET /api/practice/coding/problems
 * List coding problems from question bank
 */
router.get("/coding/problems", async (req, res, next) => {
  try {
    const { topic, difficulty } = req.query as Record<string, string>;

    const rows = await query(`
      SELECT id, category, difficulty_level, question_text AS title,
             marks, tags, starter_code
      FROM question_bank
      WHERE type IN ('coding','CODING')
        AND is_active = TRUE
        AND ($1::text IS NULL OR category = $1)
        AND ($2::text IS NULL OR difficulty_level = $2)
      ORDER BY difficulty_level, category
    `, [topic || null, difficulty || null]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/practice/coding/problems/:id
 * Get a single coding problem (with starter code, no hidden test cases)
 */
router.get("/coding/problems/:id", async (req, res, next) => {
  try {
    const problem = await queryOne(`
      SELECT id, category, difficulty_level, question_text, options,
             marks, tags, starter_code
      FROM question_bank
      WHERE id = $1 AND type IN ('coding','CODING')
    `, [req.params.id]);

    if (!problem) return res.status(404).json({ error: "Problem not found" });
    res.json({ success: true, data: problem });
  } catch (err) { next(err); }
});

/**
 * POST /api/practice/coding/run
 * Run code against custom input (no test case grading)
 */
router.post("/coding/run", async (req, res, next) => {
  try {
    const { source_code, language, stdin } = req.body;
    if (!source_code || !language) return res.status(400).json({ error: "source_code and language required" });

    const result = await executeCode({ sourceCode: source_code, language, stdin });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * POST /api/practice/coding/submit
 * Submit code — runs against hidden test cases and saves result
 */
router.post("/coding/submit", async (req, res, next) => {
  try {
    const { question_id, source_code, language } = req.body;
    if (!question_id || !source_code || !language) {
      return res.status(400).json({ error: "question_id, source_code, and language required" });
    }

    const question = await queryOne(
      "SELECT test_cases FROM question_bank WHERE id = $1",
      [question_id]
    );
    if (!question) return res.status(404).json({ error: "Problem not found" });

    const testCases = (question as any).test_cases || [];
    const gradeResult = await runTestCases(source_code, language, testCases);

    const passed = gradeResult.passed;
    const total  = gradeResult.totalTestCases;
    const hasTLE = gradeResult.testResults.some((r: any) => r.error === "TLE");
    const status = passed === total ? "accepted"
                 : hasTLE ? "time_limit_exceeded"
                 : "wrong_answer";

    const submission = await queryOne(`
      INSERT INTO coding_submissions
        (student_id, question_id, language, source_code, status, test_cases_passed, total_test_cases)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [req.user!.userId, question_id, language, source_code, status, passed, total]);

    // ── Award XP for coding ───────────────────────────────────────────────────
    await awardXP(req.user!.userId, XP_VALUES.coding_submission, "coding_submission", "Coding submission", question_id);
    if (status === "accepted") {
      await awardXP(req.user!.userId, XP_VALUES.coding_accepted, "coding_accepted", "Accepted coding solution", question_id);
      // First accepted solution badge
      const prevAccepted = await queryOne(
        "SELECT id FROM coding_submissions WHERE student_id = $1 AND status = 'accepted' AND question_id != $2 LIMIT 1",
        [req.user!.userId, question_id]
      );
      if (!prevAccepted) await checkAndAwardBadges(req.user!.userId, { triggerSlug: "code_accepted", sourceId: question_id });
    }
    // First ever submission badge
    const prevSubmission = await queryOne(
      "SELECT id FROM coding_submissions WHERE student_id = $1 AND id != $2 LIMIT 1",
      [req.user!.userId, (submission as any).id]
    );
    if (!prevSubmission) await checkAndAwardBadges(req.user!.userId, { triggerSlug: "first_code_submit", sourceId: question_id });

    res.json({
      success: true,
      data: { submission, test_results: gradeResult.testResults, passed, total, status },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/practice/coding/submissions/:questionId
 * Get submission history for a specific problem
 */
router.get("/coding/submissions/:questionId", async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT id, language, status, test_cases_passed, total_test_cases, submitted_at
      FROM coding_submissions
      WHERE student_id = $1 AND question_id = $2
      ORDER BY submitted_at DESC
    `, [req.user!.userId, req.params.questionId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
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
