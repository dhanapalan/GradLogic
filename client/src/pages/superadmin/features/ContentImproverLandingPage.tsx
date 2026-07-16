// =============================================================================
// AI Content Improver landing — pick a question, then open the improve flow.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService, { type Question } from "../../../services/questionBankService";
import { EmptyState, PageHeader } from "../features/FeatureUi";

export default function ContentImproverLandingPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    questionBankService
      .searchQuestions({ search: query || undefined, limit: 24, page: 1 })
      .then((res) => setRows(res.questions))
      .catch(() => toast.error("Failed to load questions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={Wand2}
        title="AI Content Improver"
        description="Select a question to propose grammar, distractor, explanation, or coding improvements."
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search questions…"
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
        <EmptyState message="No questions found." />
      ) : (
        <div className="space-y-2">
          {rows.map((q) => (
            <Link
              key={q.id}
              to={`/app/superadmin/learning-companion/improve/${q.id}`}
              className="block rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card hover:border-gray-300"
            >
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.question_text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {q.category} · {q.type} · {q.difficulty_level}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
