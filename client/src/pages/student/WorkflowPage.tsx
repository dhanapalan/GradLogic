import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpenCheck,
  Dumbbell,
  ClipboardCheck,
  Award,
  Check,
  ArrowRight,
  Workflow as WorkflowIcon,
} from "lucide-react";
import api from "../../lib/api";

/**
 * My Workflow — a derived Learn → Practice → Test → Certify pipeline.
 * Every metric is computed from real data the platform already stores
 * (program enrollments, practice sessions, drive results, certificates).
 * Completion criteria are shown explicitly so the pipeline is transparent,
 * not a black box.
 */

interface Enrollment {
  status: string;
  total_modules: number;
  completed_modules: number;
}
interface PracticeStats {
  sessions: { total_sessions: number; completed_sessions: number; avg_score: number };
}
interface Drive {
  session_status: string;
  score: number | null;
}

export default function WorkflowPage() {
  const enrollmentsQ = useQuery({
    queryKey: ["wf-enrollments"],
    queryFn: async () => (await api.get("/student-learning/my-enrollments")).data.data as Enrollment[],
    staleTime: 60_000,
  });
  const practiceQ = useQuery({
    queryKey: ["wf-practice"],
    queryFn: async () => (await api.get("/practice/stats")).data.data as PracticeStats,
    staleTime: 60_000,
  });
  const drivesQ = useQuery({
    queryKey: ["wf-drives"],
    queryFn: async () => (await api.get("/exam-sessions/my-drives")).data.data as Drive[],
    staleTime: 60_000,
  });
  const certsQ = useQuery({
    queryKey: ["wf-certs"],
    queryFn: async () => (await api.get("/lms/certificates/my")).data.data as unknown[],
    staleTime: 60_000,
  });

  const loading =
    enrollmentsQ.isLoading || practiceQ.isLoading || drivesQ.isLoading || certsQ.isLoading;

  // ── Derive each stage from real data ──────────────────────────────
  const enrollments = enrollmentsQ.data ?? [];
  const totalModules = enrollments.reduce((s, e) => s + (e.total_modules || 0), 0);
  const doneModules = enrollments.reduce((s, e) => s + (e.completed_modules || 0), 0);
  const learnPct = totalModules > 0 ? Math.round((doneModules / totalModules) * 100) : 0;
  const learnDone = enrollments.length > 0 && enrollments.every((e) => e.status === "completed");

  const practice = practiceQ.data?.sessions;
  const practiceDoneCount = practice?.completed_sessions ?? 0;
  const practiceAccuracy = Math.round(Number(practice?.avg_score ?? 0));
  const practicePct = Math.min(100, Math.round((practiceDoneCount / 3) * 100));
  const practiceDone = practiceDoneCount >= 3;

  const drives = drivesQ.data ?? [];
  const completedDrives = drives.filter((d) => d.session_status === "completed");
  const driveScores = completedDrives.map((d) => Number(d.score) || 0);
  const avgDriveScore = driveScores.length
    ? Math.round(driveScores.reduce((a, b) => a + b, 0) / driveScores.length)
    : 0;
  const testDone = completedDrives.length >= 1;
  const testPct = testDone ? 100 : 0;

  const certCount = (certsQ.data ?? []).length;
  const certifyDone = certCount >= 1;
  const certifyPct = certifyDone ? 100 : 0;

  const stages = [
    {
      key: "learn",
      title: "Learn",
      icon: BookOpenCheck,
      accent: "indigo",
      criterion: "Complete every enrolled program",
      metric:
        enrollments.length === 0
          ? "No programs enrolled yet"
          : `${doneModules}/${totalModules} modules · ${enrollments.length} program${enrollments.length !== 1 ? "s" : ""}`,
      pct: learnPct,
      done: learnDone,
      cta: { label: "Open Learning Portal", to: "/app/learn" },
    },
    {
      key: "practice",
      title: "Practice",
      icon: Dumbbell,
      accent: "violet",
      criterion: "Complete 3+ practice sets",
      metric:
        practiceDoneCount === 0
          ? "No practice sets completed yet"
          : `${practiceDoneCount} ${practiceDoneCount === 1 ? "set" : "sets"} done · ${practiceAccuracy}% accuracy`,
      pct: practicePct,
      done: practiceDone,
      cta: { label: "Go to Practice Arena", to: "/app/student-portal/practice" },
    },
    {
      key: "test",
      title: "Test",
      icon: ClipboardCheck,
      accent: "amber",
      criterion: "Complete at least one proctored drive",
      metric:
        completedDrives.length === 0
          ? "No drives completed yet"
          : `${completedDrives.length} completed · ${avgDriveScore} avg score`,
      pct: testPct,
      done: testDone,
      cta: { label: "View Exams", to: "/app/student-portal?tab=exams" },
    },
    {
      key: "certify",
      title: "Certify",
      icon: Award,
      accent: "emerald",
      criterion: "Earn at least one certificate",
      metric: certCount === 0 ? "No certificates yet" : `${certCount} certificate${certCount !== 1 ? "s" : ""} earned`,
      pct: certifyPct,
      done: certifyDone,
      cta: { label: "Course Catalog", to: "/app/lms/catalog" },
    },
  ];

  // The first not-done stage is the "current" one.
  const currentIdx = stages.findIndex((s) => !s.done);
  const overallPct = Math.round(stages.reduce((s, st) => s + st.pct, 0) / stages.length);

  const accentMap: Record<string, { bar: string; icon: string; ring: string }> = {
    indigo: { bar: "bg-indigo-500", icon: "bg-indigo-50 text-indigo-500 border-indigo-100", ring: "ring-indigo-400" },
    violet: { bar: "bg-violet-500", icon: "bg-violet-50 text-violet-500 border-violet-100", ring: "ring-violet-400" },
    amber: { bar: "bg-amber-500", icon: "bg-amber-50 text-amber-600 border-amber-100", ring: "ring-amber-400" },
    emerald: { bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600 border-emerald-100", ring: "ring-emerald-400" },
  };

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
