import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeLibraryAiService, {
  type DuplicateScanResult,
  type RelatedResult,
} from "../../../../services/knowledgeLibraryAiService";
import aiKnowledgeService from "../../../../services/aiKnowledgeService";

export function AiDuplicatesToolPage() {
  const [params] = useSearchParams();
  const [questionId, setQuestionId] = useState(params.get("id") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DuplicateScanResult | null>(null);

  useEffect(() => {
    if (params.get("id")) setQuestionId(params.get("id") || "");
  }, [params]);

  const run = async () => {
    if (!questionId.trim()) {
      toast.error("Question ID required");
      return;
    }
    setLoading(true);
    try {
      setResult(await knowledgeLibraryAiService.duplicates(questionId.trim()));
    } catch {
      toast.error("Duplicate scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolHeader title="Duplicate Detection" blurb="Find near-duplicates by embedding cosine similarity (≥92%)." />
      <IdRow questionId={questionId} setQuestionId={setQuestionId} onRun={run} loading={loading} label="Scan" />
      {result ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Source: {result.source.question_text.slice(0, 120)}…
            {!result.embeddingsUsed && result.message ? ` · ${result.message}` : null}
          </p>
          {result.matches.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center border border-dashed rounded-xl">No near-duplicates found.</p>
          ) : (
            result.matches.map((m) => (
              <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <p className="text-xs text-amber-700 mb-1">{(m.similarity * 100).toFixed(1)}% similar</p>
                <p className="text-gray-900">{m.question_text}</p>
                <Link to={`/app/superadmin/learning-companion/improve/${m.id}`} className="text-xs text-admin-accent hover:underline mt-2 inline-block">
                  Review →
                </Link>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AiRelatedToolPage() {
  const [params] = useSearchParams();
  const [questionId, setQuestionId] = useState(params.get("id") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RelatedResult | null>(null);
  const [recs, setRecs] = useState<Array<{ title: string; reason: string }>>([]);

  useEffect(() => {
    if (params.get("id")) setQuestionId(params.get("id") || "");
  }, [params]);

  const run = async () => {
    if (!questionId.trim()) {
      toast.error("Question ID required");
      return;
    }
    setLoading(true);
    setRecs([]);
    try {
      const data = await knowledgeLibraryAiService.related(questionId.trim());
      setResult(data);
      try {
        const llm = await aiKnowledgeService.recommend(data.source.question_text, 5);
        setRecs(llm.recommendations || []);
      } catch {
        /* optional */
      }
    } catch {
      toast.error("Related lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolHeader
        title="Related Knowledge"
        blurb="Same-topic siblings, semantic neighbors, plus AI recommendations."
      />
      <IdRow questionId={questionId} setQuestionId={setQuestionId} onRun={run} loading={loading} label="Find related" />
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{result.source.question_text}</p>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Related assets ({result.related.length})</h3>
            {result.related.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center border border-dashed rounded-xl">
                Nothing related yet — assign a topic or embed more questions.
              </p>
            ) : (
              result.related.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                  <p className="text-xs text-gray-400 mb-1">
                    {r.reason}
                    {r.similarity != null ? ` · ${(r.similarity * 100).toFixed(0)}%` : ""}
                  </p>
                  <p className="text-gray-900">{r.question_text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.category} · {r.difficulty_level}
                  </p>
                </div>
              ))
            )}
          </div>
          {recs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">AI recommendations</h3>
              <ul className="space-y-2">
                {recs.map((r) => (
                  <li key={r.title} className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ToolHeader({ title, blurb }: { title: string; blurb: string }) {
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

function IdRow({
  questionId,
  setQuestionId,
  onRun,
  loading,
  label,
}: {
  questionId: string;
  setQuestionId: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        value={questionId}
        onChange={(e) => setQuestionId(e.target.value)}
        placeholder="Question UUID"
        className="flex-1 min-w-[14rem] rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={loading}
        onClick={onRun}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Working…" : label}
      </button>
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-300 self-center" /> : null}
    </div>
  );
}
