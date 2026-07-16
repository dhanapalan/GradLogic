import { useEffect, useState } from "react";
import { FileStack, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type Flashcard } from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader } from "./FeatureUi";

export default function FlashcardsLibraryPage() {
  const [rows, setRows] = useState<Flashcard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    superadminFeaturesService
      .listFlashcards({ search: search || undefined })
      .then(setRows)
      .catch(() => toast.error("Failed to load flashcards"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={FileStack}
        title="Flashcards"
        description="Published flashcards ready for student revision."
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search front or back…"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button type="button" onClick={load} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message="No flashcards published yet."
          ctaHref="/app/superadmin/learning-companion/studio"
          ctaLabel="Generate flashcards"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((f) => (
            <div key={f.id} className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
              <p className="text-xs uppercase text-gray-400 mb-2">{f.category} · {f.difficulty}</p>
              <p className="font-medium text-gray-900">{f.front}</p>
              <p className="mt-2 text-sm text-gray-600 border-t border-gray-100 pt-2">{f.back}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
