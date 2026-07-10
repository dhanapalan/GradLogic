import { Link } from "react-router-dom";
import { Check, ArrowRight, Workflow as WorkflowIcon } from "lucide-react";
import { useWorkflowStages, ACCENT_CLASSES } from "../../hooks/useWorkflowStages";

/**
 * My Workflow — a derived Learn → Practice → Test → Certify pipeline.
 * Every metric is computed from real data the platform already stores
 * (program enrollments, practice sessions, drive results, certificates).
 * Completion criteria are shown explicitly so the pipeline is transparent,
 * not a black box.
 */

export default function WorkflowPage() {
  const { stages, currentIdx, overallPct, loading } = useWorkflowStages();
  const accentMap = ACCENT_CLASSES;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-2">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <WorkflowIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">My Workflow</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Your placement-prep journey — Learn → Practice → Test → Certify
            </p>
          </div>
        </div>
        {!loading && (
          <div className="text-right">
            <p className="text-2xl font-black text-slate-900 leading-none">{overallPct}%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Overall</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map((stage, i) => {
            const a = accentMap[stage.accent];
            const Icon = stage.icon;
            const isCurrent = i === currentIdx;
            return (
              <div key={stage.key} className="relative">
                {/* Connector line */}
                {i < stages.length - 1 && (
                  <div className="absolute left-[35px] top-[68px] h-[calc(100%-40px)] w-0.5 bg-slate-100" />
                )}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                    isCurrent ? `border-transparent ring-2 ${a.ring}` : "border-slate-100"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`relative z-10 h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center ${
                        stage.done ? "bg-emerald-500 border-emerald-500 text-white" : a.icon
                      }`}
                    >
                      {stage.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">
                          {i + 1}. {stage.title}
                        </h3>
                        {stage.done ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                            Completed
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                            In progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Up next
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">{stage.metric}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Goal: {stage.criterion}</p>

                      {/* Progress */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${stage.done ? "bg-emerald-500" : a.bar}`}
                            style={{ width: `${stage.pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-500 tabular-nums w-9 text-right">{stage.pct}%</span>
                      </div>
                    </div>

                    {(isCurrent || !stage.done) && (
                      <Link
                        to={stage.cta.to}
                        className="shrink-0 self-center hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-indigo-600 transition-all active:scale-95"
                      >
                        {stage.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
