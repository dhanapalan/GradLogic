import { useEffect, useState } from "react";
import { BookOpen, Mic, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type PublishedLesson } from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader } from "./FeatureUi";

export default function LessonsLibraryPage({ voiceOnly = false }: { voiceOnly?: boolean }) {
  const [rows, setRows] = useState<PublishedLesson[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    superadminFeaturesService
      .listLessons({ voice: voiceOnly, search: search || undefined })
      .then(setRows)
      .catch(() => toast.error("Failed to load lessons"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOnly]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={voiceOnly ? Mic : BookOpen}
        title={voiceOnly ? "Voice Lessons" : "Lessons"}
        description={
          voiceOnly
            ? "Voice-ready lesson scripts published into course modules."
            : "Published lessons across LMS courses."
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search lessons…"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message={voiceOnly ? "No voice lessons published yet." : "No lessons published yet."}
          ctaHref="/app/superadmin/learning-companion/studio"
          ctaLabel="Generate content"
        />
      ) : (
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.id} className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900">{l.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {l.course_title} · {l.module_title} · {l.content_type}
                    {l.estimated_minutes ? ` · ${l.estimated_minutes} min` : ""}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-gray-400">{l.course_category}</span>
              </div>
              {l.content_text ? (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{l.content_text}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
