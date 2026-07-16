// =============================================================================
// Knowledge Assets — Lessons (Sprint 1)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type PublishedLesson } from "../../../services/superadminFeaturesService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

export default function LessonsAssetPage() {
  const [filters, setFilters] = useState<KnowledgeFilters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState("");
  const [lessons, setLessons] = useState<PublishedLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    setLoading(true);
    superadminFeaturesService
      .listLessons({ search: debounced || undefined })
      .then((rows) => {
        let next = rows;
        if (filters.category) {
          const needle = filters.category.replace(/_/g, " ").toLowerCase();
          next = rows.filter(
            (r) =>
              (r.course_category || "").toLowerCase().includes(needle) ||
              (r.course_title || "").toLowerCase().includes(needle)
          );
        }
        setLessons(next);
      })
      .catch(() => {
        toast.error("Failed to load lessons");
        setLessons([]);
      })
      .finally(() => setLoading(false));
  }, [debounced, filters.category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Lessons
          </h2>
          <p className="text-sm text-gray-500">
            Lesson assets from the LMS catalog. Topic parenting arrives in Sprint 3.
          </p>
        </div>
        <Link
          to="/app/superadmin/knowledge-library/create"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-accent hover:underline"
        >
          <Plus className="w-4 h-4" /> Create with wizard
        </Link>
      </div>

      <KnowledgeFilterBar
        value={filters}
        onChange={setFilters}
        showType={false}
        showStatus={false}
        searchPlaceholder="Search lessons…"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : lessons.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-xl">
          No lessons published yet. Generate via Content Studio or Course Builder.
        </p>
      ) : (
        <div className="space-y-2">
          {lessons.map((l) => (
            <article key={l.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900">{l.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {l.course_title} · {l.module_title} · {l.content_type}
                    {l.estimated_minutes ? ` · ${l.estimated_minutes} min` : ""}
                  </p>
                </div>
                {l.course_id ? (
                  <Link
                    to={`/app/superadmin/courses/${l.course_id}`}
                    className="text-xs font-medium text-admin-accent hover:underline"
                  >
                    Open course →
                  </Link>
                ) : null}
              </div>
              {l.content_text ? (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{l.content_text}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
