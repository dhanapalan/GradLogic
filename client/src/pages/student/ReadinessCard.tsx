import { TrendingUp } from "lucide-react";
import { useWorkflowStages } from "../../hooks/useWorkflowStages";
import { useGamificationSummary } from "../../hooks/useGamificationSummary";

/**
 * Placement Readiness — a real composite of the student's Learn/Practice/Test/
 * Certify progress (same numbers shown on the Workflow page), not a fabricated
 * score. Batch-percentile line uses the real leaderboard rank.
 */
export default function ReadinessCard() {
  const { overallPct, loading } = useWorkflowStages();
  const { myRank, totalParticipants } = useGamificationSummary();

  if (loading) {
    return <div className="h-full min-h-[176px] animate-pulse rounded-2xl bg-slate-100 border border-slate-100" />;
  }

  const size = 100;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (overallPct / 100) * c;

  const aheadPct =
    myRank != null && totalParticipants ? Math.round((1 - myRank / totalParticipants) * 100) : null;

  return (
    <div className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-slate-100" fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            className="stroke-indigo-500 transition-all duration-700"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-900">{overallPct}</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Readiness</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placement Ready</p>
        {aheadPct != null ? (
          <p className="text-sm text-slate-700 font-medium mt-1">
            You're ahead of <span className="font-black text-slate-900">{aheadPct}%</span> of your batch.
          </p>
        ) : (
          <p className="text-sm text-slate-700 font-medium mt-1">Keep going to climb the batch ranking.</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
          <TrendingUp className="h-3.5 w-3.5" /> Learn → Practice → Test → Certify
        </div>
      </div>
    </div>
  );
}
