// =============================================================================
// GradLogic — Gamification Page
// XP · Level · Badges · Streaks · Leaderboard
// =============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import { formatCourseYears } from "../../lib/courseYears";

// =============================================================================
// TYPES
// =============================================================================

interface XpData {
  total: number;
  level: number;
  next_level_at: number;
  progress_percent: number;
}

interface Badge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
  awarded_at: string | null;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_practice_date: string | null;
}

interface RecentXp {
  points: number;
  source: string;
  description: string;
  earned_at: string;
}

interface GamificationProfile {
  xp: XpData;
  streak: StreakData;
  badges: Badge[];
  recent_xp: RecentXp[];
}

interface LeaderboardEntry {
  id: string;
  name: string;
  degree: string;
  passing_year: number;
  total_xp: number;
  level: number;
  current_streak: number;
  badge_count: number;
  rank: number;
}

// =============================================================================
// XP PROGRESS BAR
// =============================================================================

function XpCard({ xp, streak }: { xp: XpData; streak: StreakData }) {
  const levelColors = [
    "from-gray-400 to-gray-500",
    "from-green-400 to-green-600",
    "from-blue-400 to-blue-600",
    "from-purple-400 to-purple-600",
    "from-yellow-400 to-orange-500",
    "from-red-400 to-pink-500",
  ];
  const colorIdx = Math.min(Math.floor(xp.level / 5), levelColors.length - 1);
  const gradient = levelColors[colorIdx];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4 mb-4">
        {/* Level badge */}
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center shadow-md flex-shrink-0`}>
          <span className="text-white text-xs font-medium leading-none">LVL</span>
          <span className="text-white text-xl font-bold leading-none">{xp.level}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>{xp.total.toLocaleString()} XP</span>
            <span>{xp.next_level_at.toLocaleString()} XP</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
              style={{ width: `${xp.progress_percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{xp.progress_percent}% to Level {xp.level + 1}</p>
        </div>
      </div>

      {/* Streak info */}
      <div className="flex gap-3 pt-4 border-t border-gray-50">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-orange-500">
            {streak.current_streak > 0 ? "🔥" : "❄️"} {streak.current_streak}
          </div>
          <div className="text-xs text-gray-500">Current Streak</div>
        </div>
        <div className="w-px bg-gray-100" />
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-purple-600">{streak.longest_streak}</div>
          <div className="text-xs text-gray-500">Best Streak</div>
        </div>
        <div className="w-px bg-gray-100" />
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-blue-600">{xp.total.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total XP</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BADGES GRID
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  milestone:   "Milestones",
  streak:      "Streaks",
  achievement: "Achievements",
  social:      "Social",
};

function BadgesSection({ earned, allBadges }: { earned: Badge[]; allBadges: Badge[] }) {
  const [filter, setFilter] = useState<string>("all");
  const earnedSlugs = new Set(earned.map(b => b.slug));

  const categories = ["all", ...Object.keys(CATEGORY_LABELS)];

  const display = allBadges.filter(b => {
    if (filter !== "all" && b.category !== filter) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Badges</h3>
        <span className="text-sm text-gray-500">{earned.length} / {allBadges.length} earned</span>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {display.map(badge => {
          const isEarned = earnedSlugs.has(badge.slug);
          const earnedBadge = earned.find(b => b.slug === badge.slug);
          return (
            <div
              key={badge.slug}
              title={badge.description}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                isEarned
                  ? "bg-gradient-to-b from-indigo-50 to-white border-indigo-200 shadow-sm"
                  : "bg-gray-50 border-gray-100 opacity-40 grayscale"
              }`}
            >
              <span className="text-2xl">{badge.icon}</span>
              <span className="text-xs font-medium text-center text-gray-700 leading-tight">{badge.name}</span>
              {badge.xp_reward > 0 && (
                <span className="text-xs text-indigo-500 font-medium">+{badge.xp_reward} XP</span>
              )}
              {isEarned && earnedBadge && (
                <span className="text-[10px] text-gray-400">
                  {new Date(earnedBadge.awarded_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// LEADERBOARD
// =============================================================================

function LeaderboardSection() {
  const [period, setPeriod] = useState("all_time");

  const { data, isLoading } = useQuery({
    queryKey: ["gamification-leaderboard", period],
    queryFn: () => api.get(`/gamification/leaderboard?period=${period}&limit=20`).then(r => r.data.data),
  });

  const leaderboard: LeaderboardEntry[] = data?.leaderboard || [];
  const myRank: number | null = data?.my_rank || null;

  const rankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Leaderboard</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[["all_time", "All Time"], ["weekly", "Weekly"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === val ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {myRank && (
        <div className="mb-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700">
          Your rank: <strong>{rankIcon(myRank)}</strong>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                entry.rank <= 3 ? "bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-100" : "hover:bg-gray-50"
              }`}
            >
              <div className="w-8 text-center font-bold text-sm text-gray-600">{rankIcon(entry.rank)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-800 truncate">{entry.name}</div>
                <div className="text-xs text-gray-400">
                  {entry.degree} · {formatCourseYears(entry.degree, entry.passing_year, String(entry.passing_year || ""))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-indigo-600">{entry.total_xp.toLocaleString()} XP</div>
                <div className="text-xs text-gray-400">Lv {entry.level} · {entry.badge_count} badges</div>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <p className="text-center py-6 text-gray-400 text-sm">No data yet. Start practicing!</p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RECENT XP FEED
// =============================================================================

const SOURCE_ICONS: Record<string, string> = {
  practice_session:  "🎯",
  coding_submission: "💻",
  coding_accepted:   "✅",
  dev_plan_generated:"🗺️",
  badge_bonus:       "🏅",
  streak_bonus:      "🔥",
  drive_completed:   "📝",
  manual:            "⭐",
};

function RecentXpFeed({ items }: { items: RecentXp[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Recent XP</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-lg w-7 text-center">{SOURCE_ICONS[item.source] || "⭐"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{item.description}</p>
              <p className="text-xs text-gray-400">{new Date(item.earned_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <span className="text-sm font-semibold text-green-600">+{item.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

type Tab = "overview" | "badges" | "leaderboard";

export default function GamificationPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const profileQuery = useQuery<GamificationProfile>({
    queryKey: ["gamification-me"],
    queryFn: () => api.get("/gamification/me").then(r => r.data.data),
  });

  const allBadgesQuery = useQuery<Badge[]>({
    queryKey: ["gamification-badges"],
    queryFn: () => api.get("/gamification/badges").then(r => r.data.data),
  });

  const profile = profileQuery.data;
  const allBadges: Badge[] = allBadgesQuery.data || [];

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",    label: "Overview" },
    { id: "badges",      label: `Badges ${profile ? `(${profile.badges.length})` : ""}` },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Progress & Achievements</h1>
        <p className="text-gray-500 text-sm mt-1">Track your XP, badges, and campus ranking</p>
      </div>

      {/* XP Card always visible */}
      <XpCard xp={profile.xp} streak={profile.streak} />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total XP",      value: profile.xp.total.toLocaleString(), color: "text-indigo-600" },
              { label: "Level",         value: `Level ${profile.xp.level}`,        color: "text-purple-600" },
              { label: "Badges Earned", value: String(profile.badges.length),       color: "text-yellow-600" },
              { label: "Best Streak",   value: `${profile.streak.longest_streak}d`, color: "text-orange-600" },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          <RecentXpFeed items={profile.recent_xp} />

          {/* Recently earned badges */}
          {profile.badges.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Recently Earned Badges</h3>
              <div className="flex flex-wrap gap-3">
                {profile.badges.slice(0, 6).map(badge => (
                  <div key={badge.slug} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                    <span className="text-xl">{badge.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{badge.name}</p>
                      <p className="text-[10px] text-gray-400">{new Date(badge.awarded_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "badges" && (
        <BadgesSection earned={profile.badges} allBadges={allBadges} />
      )}

      {tab === "leaderboard" && <LeaderboardSection />}
    </div>
  );
}
