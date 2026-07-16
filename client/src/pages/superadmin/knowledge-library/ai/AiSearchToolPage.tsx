import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeLibraryAiService from "../../../../services/knowledgeLibraryAiService";
import type { AiSearchResult } from "../../../../services/aiSearchService";

export default function AiSearchToolPage() {
  const [q, setQ] = useState("Explain Java Collections");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSearchResult | null>(null);

  const run = async () => {
    if (q.trim().length < 2) {
      toast.error("Enter a query");
      return;
    }
    setLoading(true);
    try {
      setResult(await knowledgeLibraryAiService.search(q.trim(), 12));
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Header title="AI Search" blurb="Semantic ranking with lexical fallback across published knowledge." />
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="e.g. SQL JOIN, DSA Trees, AI basics"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : result ? (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Embeddings used: {result.embeddingsUsed ? "yes" : "lexical only"} · {result.questions.length} questions
          </p>
          <div className="space-y-2">
            {result.questions.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-900">{item.question_text}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>{item.category}</span>
                  <span>{item.difficulty_level}</span>
                  {item.similarity != null ? <span>sim {(item.similarity * 100).toFixed(0)}%</span> : null}
                  <Link
                    to={`/app/superadmin/knowledge-library/ai/related?id=${item.id}`}
                    className="text-admin-accent hover:underline"
                  >
                    Related →
                  </Link>
                  <Link
                    to={`/app/superadmin/learning-companion/improve/${item.id}`}
                    className="text-admin-accent hover:underline"
                  >
                    Improve →
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {result.relatedTopics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.relatedTopics.map((t) => (
                <span key={`${t.kind}-${t.label}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-gray-600">
                  {t.label} ({t.count})
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Header({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <Link to="/app/superadmin/knowledge-library/ai" className="text-xs text-admin-accent hover:underline">
        ← AI Features
      </Link>
      <h2 className="mt-2 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{blurb}</p>
    </div>
  );
}
