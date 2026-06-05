// =============================================================================
// Learning Portal Home — /app/learn
// Shows: in-progress courses, completed (with cert), skill programs, paths, recommendations
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../lib/api";
import {
  BookOpen, Award, ChevronRight, Play, CheckCircle2,
  Layers, Clock, Star, GraduationCap, Route, Zap, Download, Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Course {
  id: string; course_id: string; title: string; category: string;
  difficulty: string; thumbnail_url: string | null; progress_percent: number;
  enrolled_at: string; completed_at: string | null; instructor_name: string | null;
}
interface Program {
  program_id: string; program_name: string; program_type: string;
  enrolled_at: string; status: string; progress_percent?: number;
  total_modules: number; completed_modules: number;
}
interface LearningPath {
  id: string; title: string; description: string | null; target_role: string | null;
  duration_days: number | null; courses: { course_id: string; title: string }[];
}
interface Certificate {
  id: string; course_id: string | null; program_id: string | null;
  title: string; issued_at: string; student_name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DIFF_COLOR: Record<string, string> = {
  beginner: "text-emerald-600 bg-emerald-50",
  intermediate: "text-amber-600 bg-amber-50",
  advanced: "text-rose-600 bg-rose-50",
};

function ProgressBar({ pct, color = "bg-indigo-500" }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── Certificate button ────────────────────────────────────────────────────────
function CertificateButton({ courseId, onIssued }: { courseId: string; onIssued: (id: string) => void }) {
  const mut = useMutation({
    mutationFn: () => api.post(`/lms/courses/${courseId}/certificate`),
    onSuccess: (res) => {
      toast.success("Certificate issued!");
      onIssued(res.data.data.id);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed to issue certificate"),
  });
  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
    >
      {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
      Get Certificate
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LearnHomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"progress" | "programs" | "paths" | "certificates">("progress");

  const { data: coursesData } = useQuery({
    queryKey: ["learn-my-courses"],
    queryFn: () => api.get("/lms/my-courses").then(r => r.data.data as Course[]),
  });
  const { data: programsData } = useQuery({
    queryKey: ["learn-my-programs"],
    queryFn: () => api.get("/student-learning/my-enrollments").then(r => r.data.data as Program[]),
  });
  const { data: pathsData } = useQuery({
    queryKey: ["learn-paths"],
    queryFn: () => api.get("/lms/paths").then(r => r.data.data as LearningPath[]),
  });
  const { data: certsData, refetch: refetchCerts } = useQuery({
    queryKey: ["learn-certs"],
    queryFn: () => api.get("/lms/certificates/my").then(r => r.data.data as Certificate[]),
    enabled: tab === "certificates",
  });

  const courses = coursesData ?? [];
  const programs = programsData ?? [];
  const paths = pathsData ?? [];
  const certs = certsData ?? [];

  const inProgress = courses.filter(c => c.progress_percent > 0 && c.progress_percent < 100);
  const completed  = courses.filter(c => c.progress_percent >= 100);
  const notStarted = courses.filter(c => c.progress_percent === 0);

  const totalCompleted = completed.length + programs.filter(p => p.status === "completed").length;
  const totalInProgress = inProgress.length + programs.filter(p => p.status === "in_progress" || p.status === "enrolled").length;

  const tabs = [
    { key: "progress",     label: "My Courses",    count: courses.length },
    { key: "programs",     label: "Skill Programs", count: programs.length },
    { key: "paths",        label: "Learning Paths", count: paths.length },
    { key: "certificates", label: "Certificates",   count: totalCompleted },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-indigo-500" /> Learning Portal
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your learning journey in one place</p>
        </div>
        <Link to="/app/lms/catalog" className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-100 transition-colors">
          <BookOpen className="h-4 w-4" /> Browse Courses
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "In Progress",   value: totalInProgress, icon: Play,         color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
          { label: "Completed",     value: totalCompleted,  icon: CheckCircle2, color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-100" },
          { label: "Certificates",  value: certs.length || totalCompleted, icon: Award, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Paths",         value: paths.length,    icon: Route,        color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`${bg} ${border} border rounded-2xl p-4`}>
            <Icon className={`h-5 w-5 ${color} mb-2`} />
            <div className="text-2xl font-black text-slate-900">{value}</div>
            <div className="text-xs text-slate-500 font-semibold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Continue where you left off */}
      {inProgress.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
          <p className="text-indigo-200 text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Continue where you left off
          </p>
          <h2 className="font-black text-lg mb-1 truncate">{inProgress[0].title}</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-white/20 rounded-full h-1.5">
              <div className="bg-white h-1.5 rounded-full" style={{ width: `${inProgress[0].progress_percent}%` }} />
            </div>
            <span className="text-sm font-bold text-indigo-200">{inProgress[0].progress_percent}%</span>
          </div>
          <Link
            to={`/app/lms/courses/${inProgress[0].course_id ?? inProgress[0].id}`}
            className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            <Play className="h-4 w-4" /> Resume
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold border-b-2 transition-all -mb-px ${
              tab === t.key ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${tab === t.key ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── My Courses tab ──────────────────────────────────────────────────── */}
      {tab === "progress" && (
        <div className="space-y-4">
          {/* In-progress */}
          {inProgress.length > 0 && (
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">In Progress</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inProgress.map(c => (
                  <Link key={c.id} to={`/app/lms/courses/${c.course_id ?? c.id}`}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-indigo-100 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${DIFF_COLOR[c.difficulty] ?? "text-slate-500 bg-slate-100"}`}>
                        {c.difficulty}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-3">{c.title}</p>
                    <ProgressBar pct={c.progress_percent} />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">{c.progress_percent}% complete</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Completed</p>
              <div className="space-y-2">
                {completed.map(c => (
                  <div key={c.id} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 flex items-center gap-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.completed_at ? `Completed ${new Date(c.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Completed"}
                      </p>
                    </div>
                    <CertificateButton courseId={c.course_id ?? c.id} onIssued={(id) => { refetchCerts(); setTab("certificates"); }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not started */}
          {notStarted.length > 0 && (
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Not Started</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {notStarted.map(c => (
                  <Link key={c.id} to={`/app/lms/courses/${c.course_id ?? c.id}`}
                    className="bg-white rounded-2xl border border-slate-100 p-4 hover:border-indigo-100 transition-all group flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                      <Play className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-1 flex-1">{c.title}</p>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {courses.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">No courses yet</p>
              <Link to="/app/lms/catalog" className="text-indigo-600 text-sm font-bold hover:underline mt-1 inline-block">Browse catalog →</Link>
            </div>
          )}
        </div>
      )}

      {/* ── Skill Programs tab ──────────────────────────────────────────────── */}
      {tab === "programs" && (
        <div className="space-y-3">
          {programs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <Layers className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">No programs enrolled</p>
              <Link to="/app/student-portal/programs" className="text-indigo-600 text-sm font-bold hover:underline mt-1 inline-block">Browse programs →</Link>
            </div>
          ) : programs.map(p => {
            const pct = p.progress_percent ?? (p.total_modules > 0 ? Math.round((p.completed_modules / p.total_modules) * 100) : 0);
            return (
              <Link key={p.program_id} to={`/app/student-portal/programs/${p.program_id}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-indigo-100 transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.status === "completed" ? "bg-emerald-100" : "bg-indigo-100"}`}>
                  {p.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Layers className="h-5 w-5 text-indigo-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 truncate">{p.program_name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <ProgressBar pct={pct} color={p.status === "completed" ? "bg-emerald-500" : "bg-indigo-500"} />
                    <span className="text-xs font-bold text-slate-500 shrink-0">{pct}%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{p.completed_modules}/{p.total_modules} modules</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Learning Paths tab ──────────────────────────────────────────────── */}
      {tab === "paths" && (
        <div className="space-y-3">
          {paths.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <Route className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">No learning paths available yet</p>
            </div>
          ) : paths.map(path => (
            <Link key={path.id} to={`/app/learn/paths/${path.id}`}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-violet-100 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Route className="h-4 w-4 text-violet-500 shrink-0" />
                    <h3 className="text-sm font-black text-slate-900 group-hover:text-violet-600 truncate">{path.title}</h3>
                  </div>
                  {path.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{path.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {path.target_role && <span className="bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-semibold">{path.target_role}</span>}
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {path.courses.length} courses</span>
                    {path.duration_days && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {path.duration_days} days</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-violet-400 shrink-0 mt-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Certificates tab ────────────────────────────────────────────────── */}
      {tab === "certificates" && (
        <div className="space-y-3">
          {completed.length === 0 && programs.filter(p => p.status === "completed").length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <Award className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">No certificates yet</p>
              <p className="text-xs text-slate-300 mt-1">Complete a course or program to earn your first certificate</p>
            </div>
          ) : (
            <>
              {/* Issue certificates for completed courses that don't have one yet */}
              {completed.map(c => {
                const hasCert = certs.some(cert => cert.course_id === (c.course_id ?? c.id));
                return (
                  <div key={c.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${hasCert ? "border-amber-200" : "border-slate-100"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasCert ? "bg-amber-100" : "bg-slate-100"}`}>
                      <Award className={`h-5 w-5 ${hasCert ? "text-amber-500" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Course · Completed</p>
                    </div>
                    {hasCert ? (
                      <Link
                        to={`/app/certificate/${certs.find(cert => cert.course_id === (c.course_id ?? c.id))?.id}`}
                        className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> View Certificate
                      </Link>
                    ) : (
                      <CertificateButton courseId={c.course_id ?? c.id} onIssued={() => { refetchCerts(); }} />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
