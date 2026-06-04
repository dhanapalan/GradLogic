// =============================================================================
// GradLogic — Student Development Routes
// AI Development Plans · Goals · Skill Progress · Skill Gap Analysis
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import { env } from "../config/env.js";
import { awardXP, checkAndAwardBadges, XP_VALUES } from "./gamification.routes.js";
import { sendNotification } from "../services/notification.service.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const router = Router();
router.use(authenticate);

// ── Helper: Generate development plan via AI ──────────────────────────────────

async function generatePlan(studentData: {
  name: string;
  degree: string;
  skills: string[];
  score: number;
  driveTitle: string;
  segmentationTags: string[];
  weakCategories: { category: string; correct: number; total: number }[];
}) {
  const prompt = `
You are an expert career coach for campus placement preparation.
Generate a personalised development plan for a student after their assessment.

Student: ${studentData.name}
Degree: ${studentData.degree}
Skills: ${studentData.skills.join(", ") || "Not specified"}
Assessment: ${studentData.driveTitle}
Score: ${studentData.score}%
Archetype tags: ${studentData.segmentationTags.join(", ") || "None"}
Weak areas: ${studentData.weakCategories.map(c => `${c.category} (${c.correct}/${c.total} correct)`).join(", ") || "None identified"}

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-3 sentence personalised summary of the student's current standing and potential",
  "skill_gaps": [
    { "skill": "skill name", "current_level": "beginner|intermediate|advanced", "target_level": "intermediate|advanced", "priority": "high|medium|low" }
  ],
  "recommended_actions": [
    { "action": "specific actionable task", "resource_type": "course|practice|video|article", "estimated_days": 7, "deadline_days": 14, "completed": false }
  ],
  "milestones": [
    { "title": "milestone name", "target_days": 30, "description": "what to achieve" }
  ]
}
Provide 3-5 skill gaps, 5-8 recommended actions, and 3 milestones (30/60/90 days).
`.trim();

  const message = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text || "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
}

// =============================================================================
// DEVELOPMENT PLANS
// =============================================================================

/**
 * GET /api/development/plans
 * Get all development plans for the logged-in student
 */
router.get("/plans", authorize("student"), async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT dp.*, ad.name AS drive_title
      FROM student_development_plans dp
      LEFT JOIN assessment_drives ad ON ad.id = dp.drive_id
      WHERE dp.student_id = $1
      ORDER BY dp.generated_at DESC
    `, [req.user!.userId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/development/plans/:id
 */
router.get("/plans/:id", authorize("student", "mentor", "super_admin", "hr"), async (req, res, next) => {
  try {
    const plan = await queryOne(`
      SELECT dp.*, ad.name AS drive_title, u.name AS student_name
      FROM student_development_plans dp
      LEFT JOIN assessment_drives ad ON ad.id = dp.drive_id
      LEFT JOIN users u ON u.id = dp.student_id
      WHERE dp.id = $1
    `, [req.params.id]);

    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

/**
 * POST /api/development/plans/generate
 * AI-generate a development plan (on-demand or post-drive)
 */
router.post("/plans/generate", authorize("student"), async (req, res, next) => {
  try {
    const { drive_id } = req.body;
    const studentId = req.user!.userId;

    // Fetch student profile
    const student = await queryOne(`
      SELECT u.name, sd.degree, sd.skills, sd.segmentation_tags
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      WHERE u.id = $1
    `, [studentId]);

    if (!student) return res.status(404).json({ error: "Student not found" });

    // Get drive + score info if drive_id provided
    let driveTitle = "General Practice";
    let score = 0;
    let weakCategories: any[] = [];

    if (drive_id) {
      const driveInfo = await queryOne(`
        SELECT ad.name, ds.score,
          (SELECT COUNT(*) FROM drive_students WHERE drive_id = $2)::int AS total_in_drive
        FROM assessment_drives ad
        JOIN drive_students ds ON ds.drive_id = ad.id AND ds.student_id = $1
        WHERE ad.id = $2
      `, [studentId, drive_id]);

      if (driveInfo) {
        driveTitle = (driveInfo as any).name;
        score = Number((driveInfo as any).score) || 0;
      }

      // Get per-category performance from saved_answers
      const answers = await queryOne(`
        SELECT saved_answers, question_mapping FROM drive_students
        WHERE student_id = $1 AND drive_id = $2
      `, [studentId, drive_id]);

      if (answers) {
        const savedAnswers = (answers as any).saved_answers || {};
        const questionMapping = (answers as any).question_mapping || [];

        const catMap: Record<string, { correct: number; total: number }> = {};
        for (const qId of questionMapping) {
          const q = await queryOne("SELECT category, correct_answer FROM question_bank WHERE id = $1", [qId]);
          if (!q) continue;
          const cat = (q as any).category;
          if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 };
          catMap[cat].total++;
          const ans = savedAnswers[qId];
          if (ans?.selected?.includes((q as any).correct_answer)) catMap[cat].correct++;
        }
        weakCategories = Object.entries(catMap)
          .filter(([, v]) => v.total > 0 && v.correct / v.total < 0.6)
          .map(([category, v]) => ({ category, ...v }));
      }
    }

    // Generate plan via AI
    const aiResult = await generatePlan({
      name: (student as any).name,
      degree: (student as any).degree || "Not specified",
      skills: (student as any).skills || [],
      score,
      driveTitle,
      segmentationTags: (student as any).segmentation_tags || [],
      weakCategories,
    });

    // Upsert plan
    const plan = await queryOne(`
      INSERT INTO student_development_plans
        (student_id, drive_id, plan_type, ai_summary, skill_gaps, recommended_actions, milestones, score_at_generation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (student_id, drive_id) DO UPDATE SET
        ai_summary          = EXCLUDED.ai_summary,
        skill_gaps          = EXCLUDED.skill_gaps,
        recommended_actions = EXCLUDED.recommended_actions,
        milestones          = EXCLUDED.milestones,
        score_at_generation = EXCLUDED.score_at_generation,
        generated_at        = NOW(),
        status              = 'active'
      RETURNING *
    `, [
      studentId,
      drive_id || null,
      drive_id ? "post_drive" : "on_demand",
      aiResult.summary || "",
      JSON.stringify(aiResult.skill_gaps || []),
      JSON.stringify(aiResult.recommended_actions || []),
      JSON.stringify(aiResult.milestones || []),
      score,
    ]);

    // ── Award XP for plan generation ─────────────────────────────────────────
    await awardXP(studentId, XP_VALUES.dev_plan_generated, "dev_plan_generated", "AI development plan generated", (plan as any).id);

    // First plan badge
    const prevPlan = await queryOne(
      "SELECT id FROM student_development_plans WHERE student_id = $1 AND id != $2 LIMIT 1",
      [studentId, (plan as any).id]
    );
    if (!prevPlan) await checkAndAwardBadges(studentId, { triggerSlug: "plan_generated", sourceId: (plan as any).id });

    // Notify student
    await sendNotification(
      studentId,
      "Development Plan Ready",
      `Your AI development plan for "${driveTitle}" has been generated. Check it out!`,
      "info"
    );

    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

/**
 * PUT /api/development/plans/:id/action/:actionIndex
 * Mark a recommended action as completed
 */
router.put("/plans/:id/action/:actionIndex", authorize("student"), async (req, res, next) => {
  try {
    const plan = await queryOne(
      "SELECT * FROM student_development_plans WHERE id = $1 AND student_id = $2",
      [req.params.id, req.user!.userId]
    );
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const actions = (plan as any).recommended_actions as any[];
    const idx = parseInt(String(req.params.actionIndex));
    if (idx < 0 || idx >= actions.length) return res.status(400).json({ error: "Invalid action index" });

    actions[idx].completed = true;
    const completedCount = actions.filter(a => a.completed).length;
    const progressPercent = Math.round((completedCount / actions.length) * 100);

    const updated = await queryOne(`
      UPDATE student_development_plans SET
        recommended_actions = $1,
        status = CASE WHEN $2 >= 100 THEN 'completed' ELSE 'active' END
      WHERE id = $3 RETURNING *
    `, [JSON.stringify(actions), progressPercent, req.params.id]);

    res.json({ success: true, data: updated, progress_percent: progressPercent });
  } catch (err) { next(err); }
});

// =============================================================================
// GOALS
// =============================================================================

/**
 * GET /api/development/goals
 */
router.get("/goals", authorize("student"), async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT * FROM student_goals WHERE student_id = $1 ORDER BY created_at DESC",
      [req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/development/goals
 */
router.post("/goals", authorize("student"), async (req, res, next) => {
  try {
    const { title, target_role, target_date, milestones } = req.body;

    const goal = await queryOne(`
      INSERT INTO student_goals (student_id, title, target_role, target_date, milestones)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [req.user!.userId, title, target_role || null, target_date || null, JSON.stringify(milestones || [])]);

    res.status(201).json({ success: true, data: goal });
  } catch (err) { next(err); }
});

/**
 * PUT /api/development/goals/:id
 */
router.put("/goals/:id", authorize("student"), async (req, res, next) => {
  try {
    const { title, target_date, status, progress_percent, milestones } = req.body;

    const goal = await queryOne(`
      UPDATE student_goals SET
        title            = COALESCE($1, title),
        target_date      = COALESCE($2, target_date),
        status           = COALESCE($3, status),
        progress_percent = COALESCE($4, progress_percent),
        milestones       = COALESCE($5, milestones),
        updated_at       = NOW()
      WHERE id = $6 AND student_id = $7
      RETURNING *
    `, [title, target_date, status, progress_percent,
        milestones ? JSON.stringify(milestones) : null,
        req.params.id, req.user!.userId]);

    res.json({ success: true, data: goal });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/development/goals/:id
 */
router.delete("/goals/:id", authorize("student"), async (req, res, next) => {
  try {
    await query("DELETE FROM student_goals WHERE id = $1 AND student_id = $2",
      [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// =============================================================================
// SKILL PROGRESS
// =============================================================================

/**
 * GET /api/development/skills
 * Get skill proficiency breakdown for the student
 */
router.get("/skills", authorize("student", "mentor", "super_admin", "hr", "college_admin"), async (req, res, next) => {
  try {
    const studentId = (req.query.student_id as string) || req.user!.userId;

    const skills = await query(
      "SELECT * FROM skill_progress WHERE student_id = $1 ORDER BY proficiency_score DESC",
      [studentId]
    );

    // Also pull latest practice topic scores for comparison
    const practiceScores = await query(`
      SELECT topic AS skill_name, ROUND(AVG(score_percent), 1) AS avg_score, COUNT(*)::int AS sessions
      FROM practice_sessions
      WHERE student_id = $1 AND status = 'completed' AND topic IS NOT NULL
      GROUP BY topic
    `, [studentId]);

    res.json({ success: true, data: { skills, practice_scores: practiceScores } });
  } catch (err) { next(err); }
});

/**
 * POST /api/development/skills/upsert
 * Update skill proficiency (called after drive completion or practice)
 */
router.post("/skills/upsert", authorize("student"), async (req, res, next) => {
  try {
    const { skill_name, proficiency_score, assessment_source } = req.body;

    const skill = await queryOne(`
      INSERT INTO skill_progress (student_id, skill_name, proficiency_score, assessment_source, last_assessed)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (student_id, skill_name) DO UPDATE SET
        proficiency_score = $3,
        assessment_source = $4,
        last_assessed     = NOW()
      RETURNING *
    `, [req.user!.userId, skill_name, proficiency_score, assessment_source || "manual"]);

    res.json({ success: true, data: skill });
  } catch (err) { next(err); }
});

// =============================================================================
// CAMPUS VISIBILITY (college admins can view their students' plans)
// =============================================================================

/**
 * GET /api/development/campus/:collegeId/overview
 * Campus admin: view student development activity for their college
 */
router.get("/campus/:collegeId/overview", authorize("super_admin", "hr", "college_admin", "college"), async (req, res, next) => {
  try {
    const { collegeId } = req.params;

    const [planStats, goalStats, topSkills] = await Promise.all([
      queryOne(`
        SELECT
          COUNT(DISTINCT dp.student_id)::int AS students_with_plans,
          COUNT(dp.id)::int                  AS total_plans,
          COUNT(dp.id) FILTER (WHERE dp.status = 'active')::int AS active_plans,
          ROUND(AVG(dp.score_at_generation), 1) AS avg_score
        FROM student_development_plans dp
        JOIN student_details sd ON sd.user_id = dp.student_id
        WHERE sd.college_id = $1
      `, [collegeId]),

      queryOne(`
        SELECT COUNT(*)::int AS total_goals,
               COUNT(*) FILTER (WHERE status = 'achieved')::int AS achieved
        FROM student_goals sg
        JOIN student_details sd ON sd.user_id = sg.student_id
        WHERE sd.college_id = $1
      `, [collegeId]),

      query(`
        SELECT sp.skill_name, ROUND(AVG(sp.proficiency_score), 1) AS avg_proficiency, COUNT(*)::int AS students
        FROM skill_progress sp
        JOIN student_details sd ON sd.user_id = sp.student_id
        WHERE sd.college_id = $1
        GROUP BY sp.skill_name
        ORDER BY avg_proficiency DESC
        LIMIT 10
      `, [collegeId]),
    ]);

    res.json({ success: true, data: { plans: planStats, goals: goalStats, top_skills: topSkills } });
  } catch (err) { next(err); }
});

export default router;
