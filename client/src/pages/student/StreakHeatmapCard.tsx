import { Flame } from "lucide-react";
import { useGamificationSummary } from "../../hooks/useGamificationSummary";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Streak card with a real last-7-days activity heatmap (from xp_transactions,
 * not fabricated) — each bar reflects whether the student actually earned XP
 * that day. */
export default function StreakHeatmapCard() {
  const { profile, isLoading } = useGamificationSummary();

  if (isLoading) {
    return <div className="h-full min-h-[176px] animate-pulse rounded-2xl bg-slate-100 border border-slate-100" />;
  }
  if (!profile) return null;

  const { current_streak, longest_streak } = profile.streak;
  const activity = profile.activity_last_7_days;

  return (
    <div className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Flame className="h-4 w-4 text-orange-500" /> Streak
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900">{current_streak}</span>
        <span className="text-sm text-slate-400 font-medium">days</span>
      </div>
      <p className="text-xs text-slate-400 font-medium mt-1">Best: {longest_streak} days</p>

      <div className="mt-4 flex gap-1.5">
        {activity.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-6 w-full rounded-sm ${d.active ? "bg-orange-500" : "bg-slate-100"}`} />
            <span className="text-[9px] text-slate-300 font-bold">
              {DAY_LABELS[new Date(d.day).getUTCDay()]}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-400 font-medium">Last 7 days</p>
    </div>
  );
}
