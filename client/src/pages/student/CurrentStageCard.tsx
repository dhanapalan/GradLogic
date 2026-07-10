import { Link } from "react-router-dom";
import { ArrowRight, PartyPopper } from "lucide-react";
import { useWorkflowStages, ACCENT_CLASSES } from "../../hooks/useWorkflowStages";

/**
 * Compact "Current Stage" card for the Dashboard — surfaces where the student
 * is in the real Learn → Practice → Test → Certify pipeline (see WorkflowPage),
 * so the dashboard ties directly back into the workflow instead of just
 * showing disconnected KPIs.
 */
export default function CurrentStageCard() {
  const { stages, currentIdx, loading } = useWorkflowStages();

  if (loading) {
    return <div className="h-full min-h-[176px] animate-pulse rounded-2xl bg-slate-100 border border-slate-100" />;
  }

  // currentIdx === -1 means every stage is done.
  const stage = currentIdx === -1 ? stages[stages.length - 1] : stages[currentIdx];
  const allDone = currentIdx === -1;
  const accent = ACCENT_CLASSES[stage.accent];

  return (
    <div className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {allDone ? "Workflow complete" : "Current Stage"}
        </span>
      </div>
      <h3 className="text-lg font-black text-slate-900 mt-2 flex items-center gap-2">
        {allDone ? (
          <>
            <PartyPopper className="h-5 w-5 text-emerald-500" /> All stages done!
          </>
        ) : (
          stage.title
        )}
      </h3>
      <p className="text-xs text-slate-500 mt-1 flex-1">
        {allDone ? "You've completed every stage of your placement-prep workflow." : stage.metric}
      </p>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1.5">
          <span>Stage progress</span>
          <span>{stage.pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${allDone ? "bg-emerald-500" : accent.bar}`}
            style={{ width: `${stage.pct}%` }}
          />
        </div>
      </div>

      <Link
        to={allDone ? "/app/student-portal/workflow" : stage.cta.to}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white transition-all hover:bg-indigo-600 active:scale-95"
      >
        {allDone ? "View Workflow" : "Continue"} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
