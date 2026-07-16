// =============================================================================
// AI Semantic Search (Phase 10) — "instead of SQL filters."
// =============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Loader2, Tag, FileText, Video, Volume2, Sparkles, AlertTriangle,
} from "lucide-react";
import aiSearch, { type AiSearchResult } from "../../services/aiSearchService";

const EXAMPLE_QUERIES = ["Explain SQL Join", "Amazon Questions", "Easy Python", "Machine Learning"];

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-green-600 bg-green-50",
  medium: "text-amber-600 bg-amber-50",
  hard: "text-red-600 bg-red-50",
};

export default function AiSearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = (text: string) => {
    if (!text.trim()) return;
    setQ(text);
    setLoading(true);
    setError(null);
    setSearched(true);
    aiSearch
      .search(text.trim())
      .then(setResult)
      .catch(() => setError("Search failed — try again."))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Search</h1>
          <p className="text-sm text-slate-500">Search by meaning, not just keywords.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(q)}
            placeholder='Try "Explain SQL Join" or "Easy Python"…'
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg"
          />
        </div>
        <button
          onClick={() => runSearch(q)}
          disabled={loading || !q.trim()}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {!searched && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex}
              onClick={() => runSearch(ex)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full hover:border-indigo-300 hover:text-indigo-600"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          <p className="text-xs text-slate-400">
            {result.embeddingsUsed ? "Ranked by AI semantic similarity" : "Ranked by keyword relevance (AI engine unavailable right now)"}
          </p>

          {/* Related topics */}
          {result.relatedTopics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.relatedTopics.map((t) => (
                <button
                  key={`${t.kind}-${t.label}`}
                  onClick={() => runSearch(t.label)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-100"
                >
                  <Tag className="w-3 h-3" /> {t.label} ({t.count})
                </button>
              ))}
            </div>
          )}

          {/* Questions */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Questions</h2>
            {result.questions.length === 0 ? (
              <p className="text-sm text-slate-400">No matching questions.</p>
            ) : (
              <div className="space-y-2">
                {result.questions.map((q) => (
                  <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-slate-400 capitalize">{q.category.replace(/_/g, " ")}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${DIFFICULTY_COLOR[q.difficulty_level]}`}>
                        {q.difficulty_level}
                      </span>
                      {q.similarity !== null && (
                        <span className="text-[11px] text-slate-400 ml-auto">{Math.round(q.similarity * 100)}% match</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 mb-2">{q.question_text}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/app/student-portal/voice-tutor/${q.id}`)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Voice lesson
                      </button>
                      <button
                        onClick={() => navigate(`/app/student-portal/practice?topic=${q.category}`)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        Practice this topic
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Learning notes */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Learning notes
            </h2>
            {result.learningNotes.length === 0 ? (
              <p className="text-sm text-slate-400">No learning notes published yet.</p>
            ) : (
              <div className="space-y-2">
                {result.learningNotes.map((m) => (
                  <div key={m.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                    <p className="text-sm font-medium text-slate-800">{m.title}</p>
                    {m.description && <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-500" /> Videos
            </h2>
            {result.videos.length === 0 ? (
              <p className="text-sm text-slate-400">No videos published yet.</p>
            ) : (
              <div className="space-y-2">
                {result.videos.map((m) => (
                  <div key={m.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{m.title}</p>
                    {m.durationMinutes && <span className="text-xs text-slate-400">{m.durationMinutes} min</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
