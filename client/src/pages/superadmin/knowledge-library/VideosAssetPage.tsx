// =============================================================================
// Knowledge Assets — Videos (Sprint 2)
// LMS lessons with content_type = video (or video URL).
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Video } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type PublishedLesson } from "../../../services/superadminFeaturesService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

function isVideoLesson(l: PublishedLesson) {
  const type = (l.content_type || "").toLowerCase();
  if (type === "video" || type.includes("video")) return true;
  const url = (l.content_url || "").toLowerCase();
  return /\.(mp4|webm|mov|m4v)(\?|$)/.test(url) || url.includes("youtube") || url.includes("vimeo");
}

export default function VideosAssetPage() {
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
      .listLessons({ search: debounced || undefined })
      .then((list) => {
        let next = list.filter(isVideoLesson);
        if (filters.category) {
          const needle = filters.category.replace(/_/g, " ").toLowerCase();
          next = next.filter(
            (r) =>
              (r.course_category || "").toLowerCase().includes(needle) ||
              (r.course_title || "").toLowerCase().includes(needle)
          );
        }
        setRows(next);
      })
      .catch(() => {
        toast.error("Failed to load videos");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [debounced, filters.category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Video className="w-5 h-5" /> Videos
          </h2>
          <p className="text-sm text-gray-500">
            Video lessons from the course catalog (`content_type = video` or video URLs).
          </p>
        </div>
        <Link
          to="/app/superadmin/courses?action=new"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-accent hover:underline"
        >
          <Plus className="w-4 h-4" /> Add via Course Builder
        </Link>
      </div>

      <KnowledgeFilterBar
        value={filters}
        onChange={setFilters}
        showType={false}
        showStatus={false}
        searchPlaceholder="Search videos…"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-xl">
          No video lessons yet. Attach video content in Course Builder modules.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((l) => (
            <article key={l.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Video · {l.content_type}</p>
              <h3 className="font-medium text-gray-900 mt-1">{l.title}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {l.course_title} · {l.module_title}
              </p>
              {l.content_url ? (
                <a
                  href={l.content_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs font-medium text-admin-accent hover:underline"
                >
                  Open video →
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
