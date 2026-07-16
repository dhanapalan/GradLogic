import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import studentLearningService from "../../../../services/studentLearningService";
import { BASE, ErrorBlock, LoadingBlock, ProgressBar, StatusPill } from "./components";

export default function PathDetailPage() {
  const { pathId = "" } = useParams();
  const pathQ = useQuery({
    queryKey: ["learning-path", pathId],
    queryFn: () => studentLearningService.getPath(pathId),
    enabled: !!pathId,
  });

  if (pathQ.isLoading) return <LoadingBlock label="Loading path" />;
  if (pathQ.isError || !pathQ.data) {
    return <ErrorBlock message="Learning path not found." onRetry={() => pathQ.refetch()} />;
  }

  const path = pathQ.data as {
    id: string;
    title: string;
    description?: string | null;
    progress_percent: number;
    status: string;
    course_count: number;
    courses: Array<{
      course_id: string;
      title: string;
      category?: string;
      difficulty?: string;
      enrolled: boolean;
      progress_percent: number;
      status: string;
    }>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-in fade-in duration-500">
      <Link to={BASE} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
        <ArrowLeft className="h-3.5 w-3.5" /> My Learning
      </Link>
      <header className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <StatusPill status={path.status} />
          <span className="text-xs text-slate-400">{path.course_count} courses</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{path.title}</h1>
        {path.description && <p className="mt-2 text-sm text-slate-600">{path.description}</p>}
        <div className="mt-4 max-w-md">
          <ProgressBar value={path.progress_percent} label="Path progress" />
        </div>
      </header>
      <section className="space-y-2">
        <h2 className="text-sm font-black text-slate-900">Courses in this path</h2>
        <ol className="space-y-2">
          {path.courses.map((c, i) => (
            <li key={c.course_id}>
              <Link
                to={`${BASE}/courses/${c.course_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 hover:border-indigo-100"
              >
                <div>
                  <p className="text-xs font-bold text-slate-400">Course {i + 1}</p>
                  <p className="text-sm font-bold text-slate-900">{c.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {[c.category, c.difficulty].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="w-28 text-right">
                  <StatusPill status={c.enrolled ? (c.progress_percent >= 100 ? "completed" : c.progress_percent > 0 ? "in_progress" : "not_started") : "available"} />
                  {c.enrolled && (
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{Math.round(c.progress_percent)}%</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
