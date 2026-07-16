// =============================================================================
// Knowledge Assets — Flashcards (Sprint 2)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileStack, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type Flashcard } from "../../../services/superadminFeaturesService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

export default function FlashcardsAssetPage() {
  const [filters, setFilters] = useState<KnowledgeFilters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    setLoading(true);
    superadminFeaturesService
      .listFlashcards({
        search: debounced || undefined,
        category: filters.category || undefined,
      })
      .then(setRows)
      .catch(() => {
        toast.error("Failed to load flashcards");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [debounced, filters.category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileStack className="w-5 h-5" /> Flashcards
          </h2>
          <p className="text-sm text-gray-500">Front/back revision cards published from AI Studio or review.</p>
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
        searchPlaceholder="Search front or back…"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-xl">
          No flashcards yet. Generate via Create Knowledge Asset → Content Studio.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((f) => (
            <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                {f.category} · {f.difficulty}
              </p>
              <p className="font-medium text-gray-900">{f.front}</p>
              <p className="mt-2 text-sm text-gray-600 border-t border-gray-100 pt-2">{f.back}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
