import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpenCheck,
  GraduationCap,
  CheckCircle2,
  Play,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import api from "../../../lib/api";

const BASE = "/app/student-portal";

interface Enrollment {
  enrollment_id: string;
  program_id: string;
  program_name: string;
  program_description?: string;
  program_type?: string;
  total_modules: number;
  completed_modules: number;
  status: string;
  avg_score?: number | null;
}
interface AvailableProgram {
  id: string;
  name: string;
  description?: string;
  program_type?: string;
  module_count: number;
  is_enrolled?: boolean;
}

export default function LearnPage() {
  const user = useAuthStore((s) => s.user);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["student-enrollments"],
    queryFn: async () => (await api.get("/student-learning/my-enrollments")).data.data as Enrollment[],
    enabled: !!user?.id,
    staleTime: 60_000,
  });
  const { data: available = [] } = useQuery({
    queryKey: ["student-available-programs"],
    queryFn: async () => (await api.get("/student-learning/available-programs")).data.data as AvailableProgram[],
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const explore = available.filter((p) => !p.is_enrolled);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <BookOpenCheck className="h-4 w-4" /> Learn
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Learning Tracks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Structured programs to build your aptitude, technical and soft skills.
        </p>
      </div>

      {/* My programs */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
            <BookOpenCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <h2 className="text-lg font-black text-slate-900">My Programs</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-50 border border-slate-100" />)}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-400">No programs enrolled yet</p>
            <p className="text-sm text-slate-300 mt-1">Browse available programs below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrollments.map((e) => {
              const pct = e.total_modules > 0 ? Math.round((e.completed_modules / e.total_modules) * 100) : 0;
              const done = e.status === "completed";
              return (
                <Link
                  key={e.enrollment_id}
                  to={`${BASE}/programs/${e.program_id}`}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 capitalize">
                      {e.program_type?.replace(/_/g, " ") || "Program"}
                    </span>
                    {done && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{e.program_name}</h3>
                  {e.program_description && <p className="text-xs text-slate-400 line-clamp-2 mb-3">{e.program_description}</p>}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500 font-bold">
                      <span>{e.completed_modules} / {e.total_modules} modules</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {e.avg_score != null && (
                    <p className="text-xs text-slate-400 mt-2">Avg score: <span className="font-bold text-slate-600">{e.avg_score}%</span></p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Explore */}
      {explore.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <Trophy className="h-4 w-4 text-emerald-500" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Explore Programs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {explore.map((p) => (
              <Link
                key={p.id}
                to={`${BASE}/programs/${p.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                    {p.program_type?.replace(/_/g, " ") || "Program"}
                  </span>
                  <span className="text-xs text-slate-400">{p.module_count} modules</span>
                </div>
                <h3 className="font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                {p.description && <p className="text-xs text-slate-400 line-clamp-2 mb-3">{p.description}</p>}
                <span className="flex items-center gap-2 text-xs text-indigo-600 font-bold mt-3">
                  <Play className="h-3 w-3" /> Enroll &amp; start learning <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
