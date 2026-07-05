import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, Clock, CheckCircle2, Play, Lock,
  GraduationCap, Award, ChevronRight, AlertCircle, Video,
  Code2, FileText, Mic
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  video:           { label: "Video",           icon: Video,    color: "text-red-500" },
  coding_exercise: { label: "Coding Exercise", icon: Code2,    color: "text-violet-500" },
  quiz:            { label: "Quiz",            icon: FileText, color: "text-amber-500" },
  reading:         { label: "Reading",         icon: BookOpen, color: "text-blue-500" },
  soft_skill:      { label: "Soft Skill",      icon: Mic,      color: "text-pink-500" },
  live_session:    { label: "Live Session",    icon: Play,     color: "text-emerald-500" },
};

const PROGRAM_TYPE_COLORS: Record<string, string> = {
  learning_path:  "bg-blue-100 text-blue-700",
  bootcamp:       "bg-violet-100 text-violet-700",
  workshop:       "bg-amber-100 text-amber-700",
  certification:  "bg-emerald-100 text-emerald-700",
};

export default function StudentProgramPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: enrollments = [] } = useQuery<any[]>({
    queryKey: ["student-enrollments"],
    queryFn: async () => (await api.get("/student-learning/my-enrollments")).data.data,
  });

  const { data: modules = [], isLoading: loadingModules } = useQuery<any[]>({
    queryKey: ["student-program-modules", programId],
    queryFn: async () => (await api.get(`/student-learning/my-enrollments/${programId}/modules`)).data.data,
    enabled: !!programId,
  });

  const { data: availablePrograms = [] } = useQuery<any[]>({
    queryKey: ["student-available-programs"],
    queryFn: async () => (await api.get("/student-learning/available-programs")).data.data,
  });

  const enrollment = enrollments.find((e: any) => e.program_id === programId);
  const programInfo = availablePrograms.find((p: any) => p.id === programId);
  const program = enrollment || programInfo;

  const enrollMutation = useMutation({
    mutationFn: () => api.post(`/student-learning/enroll/${programId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
      qc.invalidateQueries({ queryKey: ["student-available-programs"] });
      qc.invalidateQueries({ queryKey: ["student-program-modules", programId] });
      toast.success("Enrolled successfully!");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to enroll"),
  });

  const completedModules = modules.filter((m: any) => m.progress_status === "completed").length;
  const progressPct = modules.length > 0 ? Math.round((completedModules / modules.length) * 100) : 0;
  const isEnrolled = !!enrollment;
  const isCompleted = enrollment?.status === "completed";

  // Find first incomplete module
  const nextModule = modules.find((m: any) => m.progress_status !== "completed");

  if (!program && !loadingModules) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500 font-bold">Program not found</p>
        <Link to="/app/student-portal" className="text-indigo-600 text-sm font-bold hover:underline">Back to Portal</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate("/app/student-portal")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Portal
        </button>
        <span className="text-slate-200">|</span>
        <span className="text-sm font-bold text-slate-900 truncate">{program?.program_name || program?.name}</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Program Hero */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${PROGRAM_TYPE_COLORS[program?.program_type] || "bg-slate-100 text-slate-700"}`}>
                    {program?.program_type?.replace("_", " ")}
                  </span>
                  {isCompleted && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ Completed
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-black mb-2">{program?.program_name || program?.name}</h1>
                {(program?.program_description || program?.description) && (
                  <p className="text-indigo-200/80 text-sm leading-relaxed max-w-2xl">
                    {program?.program_description || program?.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-4 text-sm text-indigo-200/70">
                  <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {modules.length} modules</span>
                  {program?.duration_days && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {program.duration_days} days</span>}
                  {enrollment?.avg_score != null && <span className="flex items-center gap-1.5"><Award className="h-4 w-4" /> Avg score: {enrollment.avg_score}%</span>}
                </div>
              </div>
              <div className="flex-shrink-0">
                {!isEnrolled ? (
                  <button
                    onClick={() => enrollMutation.mutate()}
                    disabled={enrollMutation.isPending}
                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-sm transition-colors shadow-lg disabled:opacity-50"
                  >
                    {enrollMutation.isPending ? "Enrolling..." : "Enroll Now"}
                  </button>
                ) : nextModule && !isCompleted ? (
                  <button
                    onClick={() => navigate(`/app/student-portal/programs/${programId}/modules/${nextModule.id}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-sm transition-colors shadow-lg"
                  >
                    <Play className="h-4 w-4" /> Continue
                  </button>
                ) : isCompleted ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl font-bold text-sm">
                    <GraduationCap className="h-4 w-4" /> Completed
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Progress Bar (enrolled only) */}
          {isEnrolled && (
            <div className="px-8 py-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Progress</span>
                <span className="text-sm font-black text-slate-900">{completedModules} / {modules.length} modules</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-indigo-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{progressPct}% complete</p>
            </div>
          )}
        </div>

        {/* Module List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-black text-slate-900">Modules</h2>
          </div>
          {loadingModules ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 font-bold">No modules yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {modules.map((m: any, idx: number) => {
                const mtc = TYPE_CONFIG[m.module_type] || TYPE_CONFIG.reading;
                const isDone = m.progress_status === "completed";
                const isActive = m.progress_status === "in_progress";
                const canPlay = isEnrolled;

                return (
                  <div key={m.id}
                    className={`flex items-center gap-4 px-6 py-4 transition-colors ${canPlay ? "hover:bg-slate-50 cursor-pointer" : ""}`}
                    onClick={() => canPlay && navigate(`/app/student-portal/programs/${programId}/modules/${m.id}`)}
                  >
                    {/* Status Icon */}
                    <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border font-black text-sm
                      ${isDone ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                        isActive ? "bg-indigo-50 border-indigo-200 text-indigo-600" :
                        "bg-slate-50 border-slate-200 text-slate-400"}`}>
                      {isDone ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-slate-900 text-sm truncate">{m.title}</p>
                        {!m.is_mandatory && (
                          <span className="text-[10px] font-bold text-slate-300 border border-slate-200 rounded px-1.5">Optional</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <mtc.icon className={`h-3 w-3 ${mtc.color}`} /> {mtc.label}
                        </span>
                        {m.duration_minutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.duration_minutes}m</span>}
                        {m.passing_score && <span>Pass: {m.passing_score}%</span>}
                        {isDone && m.progress_score != null && (
                          <span className="text-emerald-600 font-bold">Score: {m.progress_score}%</span>
                        )}
                        {isActive && <span className="text-indigo-600 font-bold">In Progress</span>}
                      </div>
                    </div>

                    {/* Action */}
                    {canPlay ? (
                      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enroll CTA (not enrolled) */}
        {!isEnrolled && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
            <GraduationCap className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
            <h3 className="font-black text-slate-900 mb-1">Start Learning</h3>
            <p className="text-sm text-slate-500 mb-4">Enroll in this program to unlock all modules and track your progress</p>
            <button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {enrollMutation.isPending ? "Enrolling..." : "Enroll Now — It's Free"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
