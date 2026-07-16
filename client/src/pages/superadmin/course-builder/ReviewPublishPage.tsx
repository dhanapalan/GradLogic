// =============================================================================
// Review & Publish — validate draft courses before going live (Inc 3)
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  type Course,
  type CourseValidationResult,
} from "../../../services/courseBuilderService";

interface Row {
  course: Course;
  validation: CourseValidationResult | null;
  error?: string;
}

export default function ReviewPublishPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const drafts = await courseBuilderService.listCourses({ status: "draft" });
      const validated = await Promise.all(
        drafts.map(async (course) => {
          try {
            const validation = await courseBuilderService.validateCourse(course.id);
            return { course, validation } satisfies Row;
          } catch (e: unknown) {
            return {
              course,
              validation: null,
              error: (e as Error)?.message || "Validate failed",
            } satisfies Row;
          }
        })
      );
      setRows(validated);
    } catch {
      toast.error("Failed to load draft courses");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const publish = async (courseId: string) => {
    setPublishingId(courseId);
    try {
      await courseBuilderService.publishCourse(courseId);
      toast.success("Published");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { data?: CourseValidationResult; error?: string } } };
      const v = ax.response?.data?.data;
      if (v) {
        setRows((prev) =>
          prev.map((r) => (r.course.id === courseId ? { ...r, validation: v } : r))
        );
        toast.error(v.issues.find((i) => i.severity === "error")?.message || "Blocked");
      } else {
        toast.error(ax.response?.data?.error || "Publish failed");
      }
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review & Publish</h2>
          <p className="text-sm text-gray-500">
            Drafts must meet practice / assessment gates before publish.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-500">
          No draft courses.{" "}
          <Link to={`${BASE}/new`} className="text-admin-accent hover:underline">
            Create one
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ course, validation, error }) => {
            const ok = validation?.ok === true;
            return (
              <li
                key={course.id}
                className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      className="font-semibold text-gray-900 hover:underline text-left"
                      onClick={() => navigate(`${BASE}/${course.id}`)}
                    >
                      {course.title}
                    </button>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {course.category.replace(/_/g, " ")} · {course.difficulty} ·{" "}
                      {course.total_modules} modules
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ok ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-1 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Blocked
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!ok || publishingId === course.id}
                      onClick={() => void publish(course.id)}
                      className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      {publishingId === course.id ? "Publishing…" : "Publish"}
                    </button>
                  </div>
                </div>

                {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

                {validation ? (
                  <div className="mt-3 text-xs text-gray-600">
                    <p>
                      Practice {validation.stats.practice} · Coding {validation.stats.coding} ·
                      Assessment {validation.stats.assessment} · Pass{" "}
                      {validation.config.passing_percent}% · Min practice/module{" "}
                      {validation.config.min_practice_per_module}
                    </p>
                    {validation.issues.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {validation.issues.map((issue, i) => (
                          <li key={`${issue.code}-${i}`} className="text-amber-900">
                            <span className="font-semibold uppercase mr-1">{issue.severity}</span>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
