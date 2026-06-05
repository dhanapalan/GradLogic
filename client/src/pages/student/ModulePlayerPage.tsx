import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, CheckCircle2, Clock, BookOpen,
  Code2, FileText, Video, Mic, ChevronRight, Award, AlertCircle
} from "lucide-react";
import LessonContentRenderer from "../../components/LessonContentRenderer";
import api from "../../lib/api";
import toast from "react-hot-toast";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  video:           { label: "Video",           icon: Video,     color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  coding_exercise: { label: "Coding Exercise", icon: Code2,     color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
  quiz:            { label: "Quiz",            icon: FileText,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
  reading:         { label: "Reading",         icon: BookOpen,  color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  soft_skill:      { label: "Soft Skill",      icon: Mic,       color: "text-pink-600",   bg: "bg-pink-50 border-pink-100" },
  live_session:    { label: "Live Session",    icon: Play,      color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-100" },
};

export default function ModulePlayerPage() {
  const { programId, moduleId } = useParams<{ programId: string; moduleId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState<number | "">("");

  const { data: modules = [], isLoading } = useQuery<any[]>({
    queryKey: ["student-program-modules", programId],
    queryFn: async () => (await api.get(`/student-learning/my-enrollments/${programId}/modules`)).data.data,
    enabled: !!programId,
  });

  const module = modules.find((m: any) => m.id === moduleId);
  const currentIndex = modules.findIndex((m: any) => m.id === moduleId);
  const nextModule = modules[currentIndex + 1];
  const prevModule = modules[currentIndex - 1];

  const startMutation = useMutation({
    mutationFn: () => api.post(`/student-learning/my-enrollments/${programId}/modules/${moduleId}/start`),
    onSuccess: () => {
      setStarted(true);
      qc.invalidateQueries({ queryKey: ["student-program-modules", programId] });
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
    },
    onError: () => toast.error("Failed to start module"),
  });

  const completeMutation = useMutation({
    mutationFn: (scoreVal: number | undefined) =>
      api.post(`/student-learning/my-enrollments/${programId}/modules/${moduleId}/complete`, { score: scoreVal }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["student-program-modules", programId] });
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
      if (res.data.program_completed) {
        toast.success("🎉 Program completed! Congratulations!");
      } else {
        toast.success("Module completed!");
      }
      if (nextModule) {
        navigate(`/app/student-portal/programs/${programId}/modules/${nextModule.id}`);
      } else {
        navigate(`/app/student-portal/programs/${programId}`);
      }
    },
    onError: () => toast.error("Failed to complete module"),
  });

  const isCompleted = module?.progress_status === "completed";
  const isInProgress = module?.progress_status === "in_progress" || started;
  const tc = TYPE_CONFIG[module?.module_type] || TYPE_CONFIG.reading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500 font-bold">Module not found</p>
        <Link to="/app/student-portal" className="text-indigo-600 text-sm font-bold hover:underline">Back to Portal</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/app/student-portal/programs/${programId}`)}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Program
          </button>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${tc.bg} ${tc.color}`}>
              <tc.icon className="h-3 w-3 inline mr-1" />{tc.label}
            </span>
            <span className="text-sm font-bold text-slate-900">{module.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {prevModule && (
            <button onClick={() => navigate(`/app/student-portal/programs/${programId}/modules/${prevModule.id}`)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              ← Prev
            </button>
          )}
          {nextModule && (
            <button onClick={() => navigate(`/app/student-portal/programs/${programId}/modules/${nextModule.id}`)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Module Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${tc.bg}`}>
                <tc.icon className={`h-6 w-6 ${tc.color}`} />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-black text-slate-900 mb-1">{module.title}</h1>
                {module.description && <p className="text-sm text-slate-500 leading-relaxed">{module.description}</p>}
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  {module.duration_minutes && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {module.duration_minutes} min</span>
                  )}
                  {module.difficulty_level && (
                    <span className="flex items-center gap-1 capitalize">
                      <span className={`h-2 w-2 rounded-full ${module.difficulty_level === 'beginner' ? 'bg-emerald-500' : module.difficulty_level === 'intermediate' ? 'bg-amber-500' : 'bg-red-500'}`} />
                      {module.difficulty_level}
                    </span>
                  )}
                  {module.passing_score && (
                    <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" /> Pass: {module.passing_score}%</span>
                  )}
                  {module.attempts > 0 && (
                    <span className="text-indigo-500 font-bold">Attempt #{module.attempts}</span>
                  )}
                </div>
              </div>
              {isCompleted && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-700">Completed</span>
                  {module.progress_score != null && <span className="text-xs font-bold text-emerald-600">· {module.progress_score}%</span>}
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {!isInProgress && !isCompleted ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6">
                <div className={`h-20 w-20 rounded-2xl flex items-center justify-center border-2 ${tc.bg}`}>
                  <tc.icon className={`h-10 w-10 ${tc.color}`} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black text-slate-900 mb-1">Ready to start?</h3>
                  <p className="text-sm text-slate-500">Click below to begin this {tc.label.toLowerCase()} module</p>
                </div>
                <button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" /> Start Module
                </button>
              </div>
            ) : (
              <div className="p-6">
                {/* Content renderer — handles video, PDF, text, quiz, coding, live_session */}
                <div className="mb-6">
                  <LessonContentRenderer
                    contentType={module.module_type}
                    contentUrl={module.content_url}
                    contentText={module.description}
                    title={module.title}
                    onEnded={() => {
                      // Auto-mark video modules complete when video ends
                      if (!isCompleted && module.module_type === "video") {
                        completeMutation.mutate(undefined);
                      }
                    }}
                  />
                </div>

                {/* Score input for quiz/coding */}
                {(module.module_type === "quiz" || module.module_type === "coding_exercise") && !isCompleted && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-sm font-bold text-amber-800 mb-3">Enter your score to complete this module:</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min={0} max={100} value={score}
                        onChange={e => setScore(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Score (0–100)"
                        className="w-40 px-4 py-2 rounded-xl border border-amber-200 bg-white text-sm font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                      />
                      <span className="text-sm text-amber-700 font-bold">/ 100</span>
                      {module.passing_score && (
                        <span className="text-xs text-amber-600">Passing: {module.passing_score}%</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Complete button */}
                {!isCompleted && (
                  <button
                    onClick={() => completeMutation.mutate(score !== "" ? Number(score) : undefined)}
                    disabled={completeMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completeMutation.isPending ? "Marking complete..." : "Mark as Complete"}
                  </button>
                )}

                {isCompleted && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-lg font-black text-slate-900">Module Completed!</p>
                    {module.progress_score != null && (
                      <p className="text-sm text-slate-500 mt-1">Your score: <span className="font-black text-emerald-600">{module.progress_score}%</span></p>
                    )}
                    {nextModule && (
                      <button
                        onClick={() => navigate(`/app/student-portal/programs/${programId}/modules/${nextModule.id}`)}
                        className="mt-4 flex items-center gap-2 mx-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
                      >
                        Next Module <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — Module List */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-black text-slate-900">Program Modules</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {modules.filter((m: any) => m.progress_status === "completed").length} / {modules.length} completed
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {modules.map((m: any, idx: number) => {
                const mtc = TYPE_CONFIG[m.module_type] || TYPE_CONFIG.reading;
                const isCurrent = m.id === moduleId;
                const isDone = m.progress_status === "completed";
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/app/student-portal/programs/${programId}/modules/${m.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isCurrent ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                  >
                    <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black border ${isDone ? "bg-emerald-50 border-emerald-200 text-emerald-600" : isCurrent ? "bg-indigo-100 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isCurrent ? "text-indigo-700" : "text-slate-700"}`}>{m.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <mtc.icon className={`h-3 w-3 ${mtc.color}`} />
                        <span className="text-[10px] text-slate-400">{mtc.label}</span>
                        {m.duration_minutes && <span className="text-[10px] text-slate-400">· {m.duration_minutes}m</span>}
                      </div>
                    </div>
                    {!m.is_mandatory && <span className="text-[10px] text-slate-300 font-bold">Optional</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
