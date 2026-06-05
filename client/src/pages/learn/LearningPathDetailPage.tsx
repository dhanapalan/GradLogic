// =============================================================================
// Learning Path Detail — /app/learn/paths/:id
// Shows courses in the path, enrollment status, enroll-all button
// =============================================================================

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../lib/api";
import {
  ArrowLeft, Route, BookOpen, Clock, CheckCircle2, Play,
  Loader2, ChevronRight, Star,
} from "lucide-react";

interface PathCourse {
  course_id: string; title: string; category: string;
  difficulty: string; total_modules: number; sort_order: number;
  is_required: boolean; enrolled: boolean;
}
interface LearningPath {
  id: string; title: string; description: string | null;
  target_role: string | null; duration_days: number | null;
  courses: PathCourse[];
}

const DIFF_COLOR: Record<string, string> = {
  beginner: "text-emerald-600 bg-emerald-50 border-emerald-200",
  intermediate: "text-amber-600 bg-amber-50 border-amber-200",
  advanced: "text-rose-600 bg-rose-50 border-rose-200",
};

export default function LearningPathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const qc = useQueryClient();
  const [enrolledAll, setEnrolledAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["learning-path", pathId],
    queryFn: () => api.get(`/lms/paths/${pathId}`).then(r => r.data.data as LearningPath),
    enabled: !!pathId,
  });

  const enrollMutation = useMutation({
    mutationFn: () => api.post(`/lms/paths/${pathId}/enroll`),
    onSuccess: (res) => {
      const { enrolled, skipped } = res.data.data;
      if (enrolled > 0) toast.success(`Enrolled in ${enrolled} course${enrolled > 1 ? "s" : ""}!`);
      else toast.success("Already enrolled in all courses");
      setEnrolledAll(true);
      qc.invalidateQueries({ queryKey: ["learning-path", pathId] });
      qc.invalidateQueries({ queryKey: ["learn-my-courses"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Enrolment failed"),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-slate-400">Path not found</p>
      <Link to="/app/learn" className="text-indigo-600 text-sm font-bold hover:underline">← Back to Learning</Link>
    </div>
  );

  const courses = data.courses ?? [];
  const allEnrolled = courses.every(c => c.enrolled) || enrolledAll;
  const enrolledCount = courses.filter(c => c.enrolled).length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/app/learn?tab=paths" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Learning Portal
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Route className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black leading-tight">{data.title}</h1>
            {data.target_role && (
              <span className="inline-block mt-1 text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full text-white/90">
                {data.target_role}
              </span>
            )}
          </div>
        </div>
        {data.description && <p className="text-violet-200 text-sm leading-relaxed mb-4">{data.description}</p>}
        <div className="flex items-center gap-4 text-sm text-violet-200">
          <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {courses.length} courses</span>
          {data.duration_days && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {data.duration_days} days</span>}
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {enrolledCount}/{courses.length} enrolled</span>
        </div>
      </div>

      {/* Enroll all button */}
      {!allEnrolled && (
        <button
          onClick={() => enrollMutation.mutate()}
          disabled={enrollMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-violet-200"
        >
          {enrollMutation.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Enrolling…</>
            : <><Star className="h-4 w-4" /> Enroll in All Courses</>}
        </button>
      )}
      {allEnrolled && (
        <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold text-sm">
          <CheckCircle2 className="h-4 w-4" /> Enrolled in all courses
        </div>
      )}

      {/* Course list */}
      <div className="space-y-3">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Courses in this path</p>
        {courses.map((c, idx) => (
          <div key={c.course_id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${c.enrolled ? "border-indigo-100 shadow-sm" : "border-slate-100"}`}>
            {/* Step number */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${c.enrolled ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
              {idx + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                {!c.is_required && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Optional</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${DIFF_COLOR[c.difficulty] ?? "text-slate-500 bg-slate-50 border-slate-200"}`}>
                  {c.difficulty}
                </span>
                <span className="text-xs text-slate-400">{c.total_modules} modules</span>
              </div>
            </div>

            {c.enrolled ? (
              <Link
                to={`/app/lms/courses/${c.course_id}`}
                className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors"
              >
                <Play className="h-3.5 w-3.5" /> Continue
              </Link>
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
