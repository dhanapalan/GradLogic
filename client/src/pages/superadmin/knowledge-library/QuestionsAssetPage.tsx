// =============================================================================
// Knowledge Assets — Questions (Sprint 1)
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ListChecks, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import KnowledgeObjectCard from "../../../components/superadmin/learning-companion/KnowledgeObjectCard";
import questionBankService, { type Question } from "../../../services/questionBankService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

const PAGE_SIZE = 24;

export default function QuestionsAssetPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<KnowledgeFilters>({
    ...EMPTY_FILTERS,
    type: searchParams.get("type") || "",
    status: searchParams.get("status") || "",
    category: searchParams.get("category") || "",
    tag: searchParams.get("tag") || "",
    bloom: searchParams.get("bloom") || "",
  });
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      type: searchParams.get("type") || prev.type,
      status: searchParams.get("status") || "",
      category: searchParams.get("category") || prev.category,
      tag: searchParams.get("tag") || prev.tag,
      bloom: searchParams.get("bloom") || "",
    }));
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    setLoading(true);
    questionBankService
      .searchQuestions({
        search: debounced || undefined,
        category: filters.category || undefined,
        type: filters.type || undefined,
        difficulty: filters.difficulty || undefined,
        status: filters.status || undefined,
        bloomLevel: filters.bloom || undefined,
        tags: filters.tag ? [filters.tag] : undefined,
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        setQuestions(res.questions);
        setTotal(res.total);
      })
      .catch(() => {
        toast.error("Failed to load questions");
        setQuestions([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [debounced, filters.category, filters.type, filters.difficulty, filters.status, filters.tag, filters.bloom, page]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5" /> Questions
          </h2>
          <p className="text-sm text-gray-500">
            MCQs and coding challenges from the existing question bank — same data, Knowledge Library UX.
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
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        showTag
        searchPlaceholder="Search questions…"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-xl">
          No questions match these filters.
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {questions.map((q) => (
              <KnowledgeObjectCard key={q.id} question={q} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500 self-center">
                Page {page} · {total} total
              </span>
              <button
                type="button"
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
