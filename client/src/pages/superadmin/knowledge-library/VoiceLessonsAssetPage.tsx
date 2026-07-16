// =============================================================================
// Knowledge Assets — Voice Lessons (Sprint 2)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mic, Plus } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type PublishedLesson } from "../../../services/superadminFeaturesService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

export default function VoiceLessonsAssetPage() {
  const [filters, setFilters] = useState<KnowledgeFilters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<PublishedLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    setLoading(true);
    superadminFeaturesService
      .listLessons({ voice: true, search: debounced || undefined })
      .then((list) => {
        let next = list;
        if (filters.category) {
          const needle = filters.category.replace(/_/g, " ").toLowerCase();
          next = list.filter(
            (r) =>
              (r.course_category || "").toLowerCase().includes(needle) ||
              (r.course_title || "").toLowerCase().includes(needle)
          );
        }
        setRows(next);
      })
      .catch(() => {
        toast.error("Failed to load voice lessons");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [debounced, filters.category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Mic className="w-5 h-5" /> Voice Lessons
          </h2>
          <p className="text-sm text-gray-500">
            Lessons with voice/audio content types — fuels Voice Tutor and Voice Studio.
          </p>
        </div>
        <Link
          to="/app/superadmin/learning-companion/studio?kind=voice_lessons"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-accent hover:underline"
        >
          <Plus className="w-4 h-4" /> Generate voice lesson
        </Link>
      </div>

      <KnowledgeFilterBar
        value={filters}
        onChange={setFilters}
        showType={false}
        showStatus={false}
        searchPlaceholder="Search voice lessons…"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-xl">
          No voice lessons yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((l) => (
            <article key={l.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900">{l.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {l.course_title} · {l.module_title} · {l.content_type}
                    {l.estimated_minutes ? ` · ${l.estimated_minutes} min` : ""}
                  </p>
                </div>
                {l.content_url ? (
                  <a
                    href={l.content_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-admin-accent hover:underline"
                  >
                    Open audio →
                  </a>
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
