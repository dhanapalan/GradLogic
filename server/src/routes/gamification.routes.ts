// =============================================================================
// GradLogic — Gamification Routes
// XP · Badges · Streaks · Leaderboard
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import { sendNotification } from "../services/notification.service.js";
import { sendBadgeEarnedEmail } from "../services/email.service.js";

const router = Router();
router.use(authenticate);

// =============================================================================
// XP HELPERS (exported for use by other routes)
// =============================================================================

export const XP_VALUES = {
  practice_session_completed:  20,
  practice_perfect_score:      50,   // bonus on top
  practice_high_score:         25,   // 90%+ bonus
  drive_completed:             100,
  drive_top_25_percent:        50,   // bonus
  course_enrolled:             10,
  course_lesson_completed:     5,
  course_completed:            150,
  coding_submission:           15,
  coding_accepted:             50,
  dev_plan_generated:          30,
  goal_achieved:               75,
  streak_3_days:               75,
  streak_7_days:               150,
  streak_30_days:              500,
};

export async function awardXP(
  studentId: string,
  points: number,
  source: string,
  description: string,
  sourceId?: string,
): Promise<number> {
  // Log transaction
  await queryOne(`
    INSERT INTO xp_transactions (student_id, points, source, source_id, description)
    VALUES ($1, $2, $3, $4, $5)
  `, [studentId, points, source, sourceId || null, description]);

  // Update summary
  const result = await queryOne(`
    INSERT INTO student_xp (student_id, total_xp, level, updated_at)
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT (student_id) DO UPDATE SET
      total_xp   = student_xp.total_xp + $2,
      level      = GREATEST(1, floor(sqrt((student_xp.total_xp + $2)::float / 100))::int),
      updated_at = NOW()
    RETURNING total_xp
  `, [studentId, points]);

  const newTotal = (result as any).total_xp as number;

  // Check XP-threshold badges
  await checkAndAwardBadges(studentId, { newXp: newTotal });

  return newTotal;
}

export async function checkAndAwardBadges(
  studentId: string,
  context: {
    newXp?: number;
    scorePercent?: number;
    streakDays?: number;
    triggerSlug?: string;
    sourceId?: string;
  } = {},
): Promise<string[]> {
  const awarded: string[] = [];

  // Shared helper: insert badge row + notify + email (fire-and-forget email)
  const awardBadge = async (
    badge: Record<string, unknown>,
    notificationSuffix: string,
    sourceId?: string,
  ) => {
    const inserted = await queryOne(`
      INSERT INTO student_badges (student_id, badge_id, source_id)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [studentId, badge.id, sourceId || null]);

    if (!inserted) return; // already awarded

    const slug   = badge.slug as string;
    const name   = badge.name as string;
    const icon   = (badge.icon as string) || "🏅";
    const desc   = (badge.description as string) || "";
    const reward = (badge.xp_reward as number) || 0;

    awarded.push(slug);
    await sendNotification(
      studentId,
      `Badge Unlocked: ${name}`,
      reward > 0
        ? `You earned the "${name}" badge ${icon} and received +${reward} XP!`
        : `You earned the "${name}" badge ${icon}${notificationSuffix}`,
      "success",
    );

    // Fire-and-forget email — look up student email once per badge
    queryOne("SELECT name, email FROM users WHERE id = $1", [studentId]).then(u => {
      if (u) sendBadgeEarnedEmail({
        studentName: (u as any).name, studentEmail: (u as any).email, studentId,
        badgeName: name, badgeIcon: icon, badgeDescription: desc, xpReward: reward,
      }).catch(() => {});
    }).catch(() => {});
  };

  // Auto-award by trigger slug (milestone badges)
  if (context.triggerSlug) {
    const badge = await queryOne(
      "SELECT id, slug, name, icon, description, xp_reward FROM badge_definitions WHERE slug = $1 AND is_active = TRUE",
      [context.triggerSlug]
    );
    if (badge) {
      const existing = await queryOne(
        "SELECT id FROM student_badges WHERE student_id = $1 AND badge_id = $2",
        [studentId, (badge as any).id]
      );
      if (!existing) {
        const reward = ((badge as any).xp_reward as number) || 0;
        if (reward > 0) {
          await queryOne(`
            INSERT INTO xp_transactions (student_id, points, source, description)
            VALUES ($1, $2, 'badge_bonus', 'Badge reward: ' || $3)
          `, [studentId, reward, context.triggerSlug]);
          await queryOne(`
            UPDATE student_xp SET total_xp = total_xp + $1, updated_at = NOW()
            WHERE student_id = $2
          `, [reward, studentId]);
        }
        await awardBadge(badge as Record<string, unknown>, "", context.sourceId);
      }
    }
  }

  // Auto XP threshold badges
  if (context.newXp !== undefined) {
    const xpBadges = await query(
      "SELECT id, slug, name, icon, description, xp_reward FROM badge_definitions WHERE criteria_type = 'auto_xp' AND criteria_value <= $1 AND is_active = TRUE",
      [context.newXp]
    );
    for (const badge of xpBadges) {
      await awardBadge(badge as Record<string, unknown>, " for your XP milestone!");
    }
  }

  // Auto score badges
  if (context.scorePercent !== undefined) {
    const scoreBadges = await query(
      "SELECT id, slug, name, icon, description, xp_reward FROM badge_definitions WHERE criteria_type = 'auto_score' AND criteria_value <= $1 AND is_active = TRUE",
      [context.scorePercent]
    );
    for (const badge of scoreBadges) {
      await awardBadge(badge as Record<string, unknown>, " for your score!");
    }
  }

  // Auto streak badges
  if (context.streakDays !== undefined) {
    const streakBadges = await query(
      "SELECT id, slug, name, icon, description, xp_reward FROM badge_definitions WHERE criteria_type = 'auto_streak' AND criteria_value <= $1 AND is_active = TRUE",
      [context.streakDays]
    );
    for (const badge of streakBadges) {
      await awardBadge(badge as Record<string, unknown>, " for your streak!");
    }
  }

  return awarded;
}

export async function updateStreak(studentId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const streak = await queryOne(
    "SELECT current_streak, longest_streak, last_practice_date FROM practice_streaks WHERE student_id = $1",
    [studentId]
  );

  let current = 0;
  let longest = 0;

  if (!streak) {
    await queryOne(`
      INSERT INTO practice_streaks (student_id, current_streak, longest_streak, last_practice_date)
      VALUES ($1, 1, 1, $2)
    `, [studentId, today]);
    current = 1;
    longest = 1;
  } else {
    const last = (streak as any).last_practice_date as string | null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (last === today) {
      // Already practiced today
      return (streak as any).current_streak;
    } else if (last === yesterday) {
      // Consecutive day — increment
      current = (streak as any).current_streak + 1;
      longest = Math.max(current, (streak as any).longest_streak);
    } else {
      // Streak broken
      current = 1;
      longest = (streak as any).longest_streak;
    }

    await queryOne(`
      UPDATE practice_streaks SET
        current_streak = $1, longest_streak = $2, last_practice_date = $3, updated_at = NOW()
      WHERE student_id = $4
    `, [current, longest, today, studentId]);
  }

  // Award streak badges and XP
  await checkAndAwardBadges(studentId, { streakDays: current });

  if (current === 3) await awardXP(studentId, XP_VALUES.streak_3_days, "streak_bonus", "3-day streak bonus");
  if (current === 7) await awardXP(studentId, XP_VALUES.streak_7_days, "streak_bonus", "7-day streak bonus");
  if (current === 30) await awardXP(studentId, XP_VALUES.streak_30_days, "streak_bonus", "30-day streak bonus");

  return current;
}

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * GET /api/gamification/me
 * Student's full gamification profile
 */
router.get("/me", authorize("student"), async (req, res, next) => {
  try {
    const studentId = req.user!.userId;

    const [xp, badges, streak, recentXp, weeklyXp, dailyActivity] = await Promise.all([
      queryOne(
        "SELECT total_xp, level FROM student_xp WHERE student_id = $1",
        [studentId]
      ),
      query(`
        SELECT bd.slug, bd.name, bd.description, bd.icon, bd.category, bd.xp_reward,
               sb.awarded_at
        FROM student_badges sb
        JOIN badge_definitions bd ON bd.id = sb.badge_id
        WHERE sb.student_id = $1
        ORDER BY sb.awarded_at DESC
      `, [studentId]),
      queryOne(
        "SELECT current_streak, longest_streak, last_practice_date FROM practice_streaks WHERE student_id = $1",
        [studentId]
      ),
      query(`
        SELECT points, source, description, earned_at
        FROM xp_transactions
        WHERE student_id = $1
        ORDER BY earned_at DESC
        LIMIT 10
      `, [studentId]),
      queryOne(
        `SELECT COALESCE(SUM(points), 0)::int AS total
         FROM xp_transactions
         WHERE student_id = $1 AND earned_at >= now() - interval '7 days'`,
        [studentId]
      ),
      // Real per-day activity for the last 7 days (today inclusive), used for
      // the dashboard streak heatmap — no fabricated data, just presence/absence
      // of an XP-earning event on each date.
      query(
        `SELECT gs.day::date AS day,
                EXISTS (
                  SELECT 1 FROM xp_transactions xt
                  WHERE xt.student_id = $1 AND xt.earned_at::date = gs.day
                ) AS active
         FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS gs(day)
         ORDER BY gs.day`,
        [studentId]
      ),
    ]);

    const xpToNextLevel = (level: number) => Math.pow(level + 1, 2) * 100;
    const currentLevel = (xp as any)?.level || 1;
    const currentXp = (xp as any)?.total_xp || 0;
    const prevLevelXp = Math.pow(currentLevel, 2) * 100;
    const nextLevelXp = xpToNextLevel(currentLevel);
    const progressPct = Math.round(
      ((currentXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100
    );

    res.json({
      success: true,
      data: {
        xp: {
          total: currentXp,
          level: currentLevel,
          next_level_at: nextLevelXp,
          progress_percent: Math.max(0, Math.min(100, progressPct)),
        },
        streak: streak || { current_streak: 0, longest_streak: 0, last_practice_date: null },
        badges,
        recent_xp: recentXp,
        weekly_xp: (weeklyXp as any)?.total ?? 0,
        activity_last_7_days: dailyActivity,
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/gamification/leaderboard
 * Campus leaderboard (weekly / all-time)
 */
router.get("/leaderboard", authorize("student", "mentor", "super_admin", "hr", "college_admin"), async (req, res, next) => {
  try {
    const studentId = req.user!.userId;
    const period = (req.query.period as string) || "all_time";
    const limit = parseInt(String(req.query.limit || "20"));

    // Get the student's college
    const studentInfo = await queryOne(`
      SELECT COALESCE(u.college_id, sd.college_id) AS college_id
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      WHERE u.id = $1
    `, [studentId]);

    const collegeId = (studentInfo as any)?.college_id;

    // Real-time leaderboard from xp summary
    let whereClause = "WHERE u.role = 'student'";
    const params: any[] = [limit];

    if (collegeId) {
      whereClause += ` AND COALESCE(u.college_id, sd.college_id) = $2`;
      params.push(collegeId);
    }

    const rows = await query(`
      SELECT
        u.id, u.name,
        sd.degree, sd.passing_year,
        COALESCE(sx.total_xp, 0) AS total_xp,
        COALESCE(sx.level, 1) AS level,
        COALESCE(ps.current_streak, 0) AS current_streak,
        COUNT(sb.id)::int AS badge_count,
        RANK() OVER (ORDER BY COALESCE(sx.total_xp, 0) DESC)::int AS rank
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      LEFT JOIN student_xp sx ON sx.student_id = u.id
      LEFT JOIN practice_streaks ps ON ps.student_id = u.id
      LEFT JOIN student_badges sb ON sb.student_id = u.id
      ${whereClause}
      GROUP BY u.id, u.name, sd.degree, sd.passing_year, sx.total_xp, sx.level, ps.current_streak
      ORDER BY total_xp DESC
      LIMIT $1
    `, params);

    // Find current student's rank
    const myRank = await queryOne(`
      SELECT rank FROM (
        SELECT u.id, RANK() OVER (ORDER BY COALESCE(sx.total_xp, 0) DESC)::int AS rank
        FROM users u
        LEFT JOIN student_details sd ON sd.user_id = u.id
        LEFT JOIN student_xp sx ON sx.student_id = u.id
        WHERE u.role = 'student'
          ${collegeId ? "AND COALESCE(u.college_id, sd.college_id) = $2" : ""}
      ) ranked WHERE id = $1
    `, collegeId ? [studentId, collegeId] : [studentId]);

    const totalParticipants = await queryOne(
      `SELECT COUNT(*)::int AS total
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE u.role = 'student'
         ${collegeId ? "AND COALESCE(u.college_id, sd.college_id) = $1" : ""}`,
      collegeId ? [collegeId] : []
    );

    res.json({
      success: true,
      data: {
        leaderboard: rows,
        my_rank: (myRank as any)?.rank || null,
        total_participants: (totalParticipants as any)?.total ?? rows.length,
        period,
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/gamification/badges
 * All available badge definitions
 */
router.get("/badges", async (_req, res, next) => {
  try {
    const badges = await query(
      "SELECT * FROM badge_definitions WHERE is_active = TRUE ORDER BY category, xp_reward DESC"
    );
    res.json({ success: true, data: badges });
  } catch (err) { next(err); }
});

/**
 * POST /api/gamification/xp
 * Manually award XP (admin/system use)
 */
router.post("/xp", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    const { student_id, points, source, description } = req.body;
    if (!student_id || !points) return res.status(400).json({ error: "student_id and points required" });
    const newTotal = await awardXP(student_id, points, source || "manual", description || "Manual award");
    res.json({ success: true, data: { total_xp: newTotal } });
  } catch (err) { next(err); }
});

/**
 * GET /api/gamification/stats/:collegeId
 * College-level gamification overview for admins
 */
router.get("/stats/:collegeId", authorize("super_admin", "hr", "college_admin"), async (req, res, next) => {
  try {
    const { collegeId } = req.params;

    const [topStudents, badgeStats, streakStats] = await Promise.all([
      query(`
        SELECT u.id, u.name, COALESCE(sx.total_xp, 0) AS total_xp, COALESCE(sx.level, 1) AS level
        FROM users u
        LEFT JOIN student_details sd ON sd.user_id = u.id
        LEFT JOIN student_xp sx ON sx.student_id = u.id
        WHERE COALESCE(u.college_id, sd.college_id) = $1 AND u.role = 'student'
        ORDER BY total_xp DESC LIMIT 10
      `, [collegeId]),

      queryOne(`
        SELECT
          COUNT(DISTINCT sb.student_id)::int AS students_with_badges,
          COUNT(sb.id)::int AS total_badges_awarded
        FROM student_badges sb
        JOIN users u ON u.id = sb.student_id
        LEFT JOIN student_details sd ON sd.user_id = u.id
        WHERE COALESCE(u.college_id, sd.college_id) = $1
      `, [collegeId]),

      queryOne(`
        SELECT
          ROUND(AVG(ps.current_streak))::int AS avg_streak,
          MAX(ps.current_streak)::int AS max_streak,
          COUNT(*) FILTER (WHERE ps.current_streak >= 7)::int AS students_on_7day_streak
        FROM practice_streaks ps
        JOIN users u ON u.id = ps.student_id
        LEFT JOIN student_details sd ON sd.user_id = u.id
        WHERE COALESCE(u.college_id, sd.college_id) = $1
      `, [collegeId]),
    ]);

    res.json({ success: true, data: { top_students: topStudents, badges: badgeStats, streaks: streakStats } });
  } catch (err) { next(err); }
});

export default router;
