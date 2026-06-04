// =============================================================================
// TalentSecure AI — Mock Interview Routes
// POST   /api/mock-interviews/start                    student starts a session
// POST   /api/mock-interviews/:id/complete             client reports call finished
// GET    /api/mock-interviews/my-sessions              student's history
// GET    /api/mock-interviews/:id                      single session
// GET    /api/mock-interviews/:id/feedback             Claude-generated feedback
// GET    /api/mock-interviews/:id/recommended-programs skill-gap → LMS match
// GET    /api/mock-interviews/config                   Vapi public key
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  fetchVapiCall,
  formatTranscript,
  analyseInterview,
  buildAssistantConfig,
  type VapiMessage,
} from "../services/vapi.service.js";

const router = Router();
router.use(authenticate);

// ── GET /config — return Vapi public key + assistant builder ─────────────────
// Called by client before starting a call so it knows the public key
router.get("/config", authorize("student"), (_req, res) => {
  res.json({
    success: true,
    data: { vapi_public_key: env.VAPI_PUBLIC_KEY },
  });
});

// ── GET /my-sessions ─────────────────────────────────────────────────────────
router.get("/my-sessions", authorize("student"), async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        s.id, s.target_role, s.difficulty, s.status,
        s.duration_seconds, s.started_at, s.completed_at,
        f.overall_score, f.communication_score, f.technical_score, f.confidence_score
      FROM mock_interview_sessions s
      LEFT JOIN mock_interview_feedback f ON f.session_id = s.id
      WHERE s.student_id = $1
      ORDER BY s.created_at DESC
    `, [req.user!.userId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /start — create session + return Vapi assistant config to client ────
router.post("/start", authorize("student"), async (req, res, next) => {
  try {
    const { target_role, difficulty = "medium", drive_id } = req.body;
    if (!target_role) return res.status(400).json({ error: "target_role is required" });

    const studentId = req.user!.userId;

    // Fetch student profile for personalised prompt
    const student = await queryOne<{ name: string; degree: string; skills: string[] }>(
      "SELECT u.name, sd.degree, sd.skills FROM users u LEFT JOIN student_details sd ON sd.user_id = u.id WHERE u.id = $1",
      [studentId]
    );

    // Create pending session
    const session = await queryOne<{ id: string }>(
      `INSERT INTO mock_interview_sessions (student_id, drive_id, target_role, difficulty, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [studentId, drive_id || null, target_role, difficulty]
    );

    const assistantConfig = buildAssistantConfig({
      targetRole: target_role,
      difficulty,
      studentName: (student as any)?.name || "Candidate",
      degree: (student as any)?.degree,
      skills: (student as any)?.skills,
    });

    res.status(201).json({
      success: true,
      data: {
        session_id: (session as any).id,
        vapi_public_key: env.VAPI_PUBLIC_KEY,
        assistant_config: assistantConfig,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /:id/complete — client calls this when Vapi call ends ───────────────
// Body: { vapi_call_id }  — we fetch the transcript and run Claude analysis
router.post("/:id/complete", authorize("student"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vapi_call_id } = req.body;

    if (!vapi_call_id) return res.status(400).json({ error: "vapi_call_id is required" });

    // Verify ownership
    const session = await queryOne(
      "SELECT * FROM mock_interview_sessions WHERE id = $1 AND student_id = $2",
      [id, req.user!.userId]
    );
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Mark active while we fetch
    await queryOne(
      "UPDATE mock_interview_sessions SET status = 'active', vapi_call_id = $1 WHERE id = $2",
      [vapi_call_id, id]
    );

    let messages: VapiMessage[] = [];
    let durationSeconds = 0;

    // Fetch transcript from Vapi (best-effort — don't fail the request)
    if (env.VAPI_API_KEY) {
      try {
        const call = await fetchVapiCall(vapi_call_id);
        messages = call.messages?.filter(m => m.role === "user" || m.role === "assistant") ?? [];
        durationSeconds = call.duration ?? 0;
      } catch (err: any) {
        logger.warn("Failed to fetch Vapi call transcript", { error: err.message, vapi_call_id });
      }
    }

    const transcriptText = formatTranscript(messages);

    // Persist transcript + mark completed
    await queryOne(
      `UPDATE mock_interview_sessions SET
         status = 'completed', transcript = $1, duration_seconds = $2, completed_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(messages), durationSeconds, id]
    );

    // Generate feedback asynchronously — respond to client immediately
    res.json({ success: true, data: { session_id: id, status: "completed" } });

    // Run Claude analysis in background
    setImmediate(async () => {
      try {
        const student = await queryOne<{ name: string; degree: string; skills: string[] }>(
          "SELECT u.name, sd.degree, sd.skills FROM users u LEFT JOIN student_details sd ON sd.user_id = u.id WHERE u.id = $1",
          [req.user!.userId]
        );
        const s = session as any;
        const feedback = await analyseInterview({
          transcript: transcriptText,
          targetRole: s.target_role,
          difficulty: s.difficulty,
          studentName: (student as any)?.name || "Candidate",
          degree: (student as any)?.degree,
          skills: (student as any)?.skills,
        });

        await queryOne(
          `INSERT INTO mock_interview_feedback
             (session_id, overall_score, communication_score, technical_score, confidence_score,
              summary, strengths, improvements, skill_gaps, transcript_highlights, recommended_courses)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (session_id) DO UPDATE SET
             overall_score = EXCLUDED.overall_score,
             communication_score = EXCLUDED.communication_score,
             technical_score = EXCLUDED.technical_score,
             confidence_score = EXCLUDED.confidence_score,
             summary = EXCLUDED.summary,
             strengths = EXCLUDED.strengths,
             improvements = EXCLUDED.improvements,
             skill_gaps = EXCLUDED.skill_gaps,
             transcript_highlights = EXCLUDED.transcript_highlights,
             recommended_courses = EXCLUDED.recommended_courses,
             generated_at = NOW()`,
          [
            id,
            feedback.overall_score,
            feedback.communication_score,
            feedback.technical_score,
            feedback.confidence_score,
            feedback.summary,
            JSON.stringify(feedback.strengths),
            JSON.stringify(feedback.improvements),
            JSON.stringify(feedback.skill_gaps),
            JSON.stringify(feedback.transcript_highlights),
            JSON.stringify(feedback.recommended_courses),
          ]
        );

        logger.info("Mock interview feedback generated", { session_id: id });
      } catch (err: any) {
        logger.error("Background feedback generation failed", { error: err.message, session_id: id });
      }
    });
  } catch (err) { next(err); }
});

// ── GET /:id — session details ───────────────────────────────────────────────
router.get("/:id", authorize("student", "mentor", "super_admin", "hr"), async (req, res, next) => {
  try {
    const session = await queryOne(`
      SELECT s.*, u.name AS student_name
      FROM mock_interview_sessions s
      JOIN users u ON u.id = s.student_id
      WHERE s.id = $1
    `, [req.params.id]);

    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

// ── GET /:id/feedback ────────────────────────────────────────────────────────
router.get("/:id/feedback", authorize("student", "mentor", "super_admin", "hr"), async (req, res, next) => {
  try {
    const feedback = await queryOne(`
      SELECT f.*, s.target_role, s.difficulty, s.duration_seconds, s.completed_at
      FROM mock_interview_feedback f
      JOIN mock_interview_sessions s ON s.id = f.session_id
      WHERE f.session_id = $1
    `, [req.params.id]);

    if (!feedback) {
      // Feedback may still be generating
      const session = await queryOne(
        "SELECT status FROM mock_interview_sessions WHERE id = $1",
        [req.params.id]
      );
      if (!session) return res.status(404).json({ error: "Session not found" });
      return res.json({ success: true, data: null, status: (session as any).status });
    }

    res.json({ success: true, data: feedback });
  } catch (err) { next(err); }
});

// ── GET /:id/recommended-programs ───────────────────────────────────────────
// Match skill_gaps from interview feedback to real skill_programs in the LMS.
// For each gap, search programs whose name/description contains the skill term.
// Also returns enrollment status so the client can show Enroll vs Enrolled.
router.get("/:id/recommended-programs", authorize("student"), async (req, res, next) => {
  try {
    const studentId = req.user!.userId;

    // Load skill_gaps from feedback for this session
    const feedback = await queryOne(
      "SELECT skill_gaps FROM mock_interview_feedback WHERE session_id = $1",
      [req.params.id]
    );

    if (!feedback) return res.json({ success: true, data: [] });

    const gaps: { skill: string; priority: string }[] = (feedback as any).skill_gaps ?? [];
    if (!gaps.length) return res.json({ success: true, data: [] });

    // Build ILIKE conditions for each skill term — one OR chain per term
    // e.g. gaps = [{skill:"System Design"},{skill:"DSA"}]
    // → WHERE (name ILIKE '%System Design%' OR description ILIKE '%System Design%')
    //      OR (name ILIKE '%DSA%' OR description ILIKE '%DSA%')
    const params: string[] = [];
    const clauses = gaps.map(g => {
      params.push(`%${g.skill}%`);
      const i = params.length;
      return `(sp.name ILIKE $${i} OR sp.description ILIKE $${i} OR sp.name ILIKE $${i})`;
    });

    const rows = await query(
      `SELECT
         sp.id, sp.name, sp.description, sp.program_type, sp.duration_days,
         sp.banner_url,
         (SELECT COUNT(*)::int FROM program_modules pm WHERE pm.program_id = sp.id) AS module_count,
         (SELECT COUNT(*)::int FROM student_program_enrollments e WHERE e.program_id = sp.id) AS enrollment_count,
         EXISTS(
           SELECT 1 FROM student_program_enrollments e2
           WHERE e2.program_id = sp.id AND e2.student_id = $${params.length + 1}
         ) AS already_enrolled
       FROM skill_programs sp
       WHERE sp.is_active = TRUE AND (${clauses.join(" OR ")})
       ORDER BY sp.name
       LIMIT 6`,
      [...params, studentId]
    );

    // Annotate each result with which gap(s) it matched
    const results = (rows as any[]).map(row => {
      const matchedGaps = gaps
        .filter(g => {
          const term = g.skill.toLowerCase();
          return (
            (row.name ?? "").toLowerCase().includes(term) ||
            (row.description ?? "").toLowerCase().includes(term)
          );
        })
        .map(g => ({ skill: g.skill, priority: g.priority }));
      return { ...row, matched_gaps: matchedGaps };
    });

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

export default router;
