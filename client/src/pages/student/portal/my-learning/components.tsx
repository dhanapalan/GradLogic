import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock,
  Play,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Award,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { LearningCourse, LearningPath } from "../../../../services/studentLearningService";

export const BASE = "/app/student-portal/my-learning";

export function statusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    case "not_started":
      return "Not Started";
    case "available":
      return "Available";
    case "overdue":
      return "Overdue";
    default:
      return status.replace(/_/g, " ");
  }
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    in_progress: "bg-sky-50 text-sky-700 border-sky-100",
    not_started: "bg-slate-50 text-slate-600 border-slate-200",
    available: "bg-indigo-50 text-indigo-700 border-indigo-100",
    overdue: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        styles[status] || styles.not_started
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-[11px] font-semibold text-slate-500">
          <span>{label}</span>
          <span>{v}%</span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Progress"}
      >
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-100 bg-white" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" aria-label={label} />
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden />
      <p className="text-sm font-bold text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700" role="alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold">{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-2 font-bold underline">
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CourseCard({ course }: { course: LearningCourse }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-100 to-slate-50">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-slate-300" aria-hidden />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusPill status={course.completion_status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-black text-slate-900">{course.title}</h3>
        <p className="text-xs text-slate-500">
          {course.instructor_name || "Instructor TBA"}
          {course.category ? ` · ${course.category}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {course.difficulty && <span className="rounded bg-slate-50 px-1.5 py-0.5">{course.difficulty}</span>}
          {course.duration_hours != null && (
            <span className="inline-flex items-center gap-0.5 rounded bg-slate-50 px-1.5 py-0.5">
              <Clock className="h-3 w-3" /> {course.duration_hours}h
            </span>
          )}
        </div>
        {course.is_assigned && <ProgressBar value={course.progress_percent} label="Progress" />}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link
            to={`${BASE}/courses/${course.id}`}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            {course.completion_status === "in_progress" ? (
              <>
                <Play className="h-3.5 w-3.5" /> Continue
              </>
            ) : course.completion_status === "completed" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> View
              </>
            ) : (
              <>
                <BookOpen className="h-3.5 w-3.5" /> Open Course
              </>
            )}
          </Link>
          <Link
            to={`${BASE}/courses/${course.id}`}
            className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PathCard({ path }: { path: LearningPath }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">{path.title}</h3>
        <StatusPill status={path.status} />
      </div>
      {path.description && <p className="mb-3 line-clamp-2 text-xs text-slate-500">{path.description}</p>}
      <p className="mb-2 text-[11px] font-semibold text-slate-400">
        {path.course_count === 1 ? "1 course" : `${path.course_count} courses`}
        {path.due_date ? ` · Due ${new Date(path.due_date).toLocaleDateString()}` : ""}
      </p>
      <ProgressBar value={path.progress_percent} label="Path progress" />
      <div className="mt-3 flex gap-2">
        <Link
          to={`${BASE}/paths/${path.id}`}
          className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
        >
          View Path <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        {path.status === "in_progress" && (
          <Link
            to={`${BASE}/paths/${path.id}`}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
          >
            Continue
          </Link>
        )}
      </div>
    </article>
  );
}

export function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof BookOpen;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-indigo-400" aria-hidden />
      </div>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export { Award, Circle, Play, CheckCircle2, Clock, BookOpen };
