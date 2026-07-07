import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Target, Flame, CheckCircle2, ArrowRight } from "lucide-react";
import studentPracticeService from "../../services/studentPracticeService";

/**
 * Daily Target — the student's per-day practice goal (set by their college),
 * framed as their daily "tests" to clear. Shows today's progress + streak.
 */
export default function DailyTargetCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-daily-target"],
    queryFn: () => studentPracticeService.getDailyTarget(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-2xl bg-slate-100 border border-slate-100" />;
  }
  if (!data) return null;

  // A target of 0 means the college has disabled the daily goal.
  if (data.target === 0) return null;

  const pct = data.target > 0 ? Math.min(100, Math.round((data.completed_today / data.target) * 100)) : 0;
  const met = data.met;

  return (
    <div
      className={`rounded-2xl p-5 border shadow-sm ${
        met
          ? "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 text-white"
          : "bg-white border-slate-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              met ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-500 border border-indigo-100"
            }`}
          >
            {met ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
          </div>
          <div>
            <p className={`font-black text-sm ${met ? "text-white" : "text-slate-900"}`}>Daily Target</p>
            <p className={`text-xs ${met ? "text-emerald-100" : "text-slate-400"}`}>
              {met
                ? "Done for today — great work!"
                : `${data.remaining} more practice ${data.remaining === 1 ? "set" : "sets"} to go`}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            met ? "bg-white/20 text-white" : "bg-amber-50 text-amber-600 border border-amber-100"
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          {data.current_streak}-day streak
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className={`flex items-center justify-between text-xs font-bold mb-1.5 ${met ? "text-emerald-50" : "text-slate-500"}`}>
          <span>{data.completed_today} of {data.target} completed</span>
          <span>{pct}%</span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${met ? "bg-white/25" : "bg-slate-100"}`}>
          <div
            className={`h-full rounded-full transition-all ${met ? "bg-white" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!met && (
        <Link
          to="/app/student-portal/practice"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-indigo-700"
        >
          Start practice <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
