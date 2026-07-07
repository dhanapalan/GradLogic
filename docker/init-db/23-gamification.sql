-- =============================================================================
-- GradLogic Phase 2 Migration
-- Gamification — XP, Badges, Streaks, Leaderboard
-- =============================================================================

-- ── XP Transactions ──────────────────────────────────────────────────────────
-- Every XP earn/spend is logged here for full auditability

CREATE TABLE IF NOT EXISTS xp_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points      INT NOT NULL,                  -- positive = earn, negative = spend
  source      TEXT NOT NULL,                 -- practice_session, drive_completed, course_completed, badge_bonus, streak_bonus
  source_id   UUID,                          -- FK to the originating record (optional)
  description TEXT,
  earned_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_student    ON xp_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_xp_source     ON xp_transactions(source);
CREATE INDEX IF NOT EXISTS idx_xp_earned_at  ON xp_transactions(earned_at);

-- ── Student XP Summary (denormalised for fast leaderboard queries) ────────────

CREATE TABLE IF NOT EXISTS student_xp (
  student_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp      INT DEFAULT 0,
  level         INT DEFAULT 1,              -- computed from total_xp
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Badge Definitions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badge_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,       -- e.g. first_practice, streak_7, top_10_percent
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,                       -- emoji or icon name
  xp_reward     INT DEFAULT 0,
  category      TEXT DEFAULT 'achievement', -- achievement, streak, milestone, social
  criteria_type TEXT NOT NULL,              -- manual, auto_xp, auto_streak, auto_score
  criteria_value NUMERIC,                  -- threshold value for auto criteria
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Awarded Badges ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id      UUID NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  awarded_at    TIMESTAMPTZ DEFAULT NOW(),
  source_id     UUID,                       -- drive/session that triggered this
  UNIQUE(student_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges(student_id);

-- ── Practice Streaks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS practice_streaks (
  student_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak   INT DEFAULT 0,           -- consecutive days with practice
  longest_streak   INT DEFAULT 0,
  last_practice_date DATE,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Leaderboard (weekly snapshot, refreshed by backend) ──────────────────────

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  college_id   UUID REFERENCES colleges(id) ON DELETE CASCADE,
  period_type  TEXT NOT NULL,               -- weekly, monthly, all_time
  period_start DATE NOT NULL,
  total_xp     INT DEFAULT 0,
  rank         INT,
  delta_rank   INT DEFAULT 0,               -- rank change from previous period
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period  ON leaderboard_snapshots(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_leaderboard_college ON leaderboard_snapshots(college_id, period_type);

-- ── Seed: Default Badge Definitions ──────────────────────────────────────────

INSERT INTO badge_definitions (slug, name, description, icon, xp_reward, category, criteria_type, criteria_value) VALUES
  ('first_practice',    'First Step',        'Completed your first practice session',          '🎯', 50,  'milestone',    'manual',       NULL),
  ('streak_3',          '3-Day Streak',      'Practiced 3 days in a row',                      '🔥', 75,  'streak',       'auto_streak',  3),
  ('streak_7',          'Week Warrior',      'Practiced 7 days in a row',                      '⚡', 150, 'streak',       'auto_streak',  7),
  ('streak_30',         'Month Master',      'Practiced 30 days in a row',                     '💎', 500, 'streak',       'auto_streak',  30),
  ('first_drive',       'Assessment Ready',  'Completed your first assessment drive',           '📝', 100, 'milestone',    'manual',       NULL),
  ('perfect_score',     'Perfect Score',     'Scored 100% in a practice session',              '🌟', 200, 'achievement',  'auto_score',   100),
  ('high_scorer',       'High Achiever',     'Scored 90%+ in a practice session',              '🏆', 100, 'achievement',  'auto_score',   90),
  ('first_course',      'Learner',           'Enrolled in your first course',                  '📚', 50,  'milestone',    'manual',       NULL),
  ('course_complete',   'Course Champion',   'Completed a full course',                        '🎓', 300, 'milestone',    'manual',       NULL),
  ('xp_500',            'Rising Star',       'Earned 500 XP total',                            '⭐', 0,   'achievement',  'auto_xp',      500),
  ('xp_1000',           'Dedicated',         'Earned 1000 XP total',                           '🚀', 0,   'achievement',  'auto_xp',      1000),
  ('xp_5000',           'Elite',             'Earned 5000 XP total',                           '👑', 0,   'achievement',  'auto_xp',      5000),
  ('first_code_submit', 'Code Warrior',      'Submitted your first coding solution',           '💻', 100, 'milestone',    'manual',       NULL),
  ('code_accepted',     'Problem Solver',    'Got an accepted solution',                       '✅', 150, 'achievement',  'manual',       NULL),
  ('plan_generated',    'Planner',           'Generated your first AI development plan',       '🗺️', 75,  'milestone',    'manual',       NULL)
ON CONFLICT (slug) DO NOTHING;
