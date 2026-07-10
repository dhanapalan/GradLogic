import { Trophy } from "lucide-react";
import { useGamificationSummary } from "../../hooks/useGamificationSummary";

/** Soft weekly XP target — 1000 is a fixed engagement goal (no per-college
 * configuration exists for this yet), but the earned amount is 100% real. */
const WEEKLY_XP_GOAL = 1000;

export default function WeeklyGoalCard() {
  const { profile, todayXp, isLoading } = useGamificationSummary();

  if (isLoading) {
    return <div className="h-full min-h-[176px] animate-pulse rounded-2xl bg-slate-100 border border-slate-100" />;
  }
  if (!profile) return null;

  const pct = Math.min(100, Math.round((profile.weekly_xp / WEEKLY_XP_GOAL) * 100));

  return (
    <div className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Trophy className="h-4 w-4 text-amber-500" /> Weekly Goal
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900">{profile.weekly_xp}</span>
        <span className="text-sm text-slate-400 font-medium">/ {WEEKLY_XP_GOAL} XP</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400 font-medium">
        {todayXp > 0 ? `+${todayXp} XP earned today` : "No XP earned yet today"}
      </p>
    </div>
  );
}
