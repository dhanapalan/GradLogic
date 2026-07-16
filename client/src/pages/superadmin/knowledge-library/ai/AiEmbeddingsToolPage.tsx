import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeLibraryAiService from "../../../../services/knowledgeLibraryAiService";
import aiAnalyticsService from "../../../../services/aiAnalyticsService";

export default function AiEmbeddingsToolPage() {
  const [coverage, setCoverage] = useState<{ total: number; with_embedding: number } | null>(null);
  const [pairs, setPairs] = useState<Array<{ a: { id: string; question_text: string }; b: { id: string; question_text: string }; similarity: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      knowledgeLibraryAiService.embeddingCoverage().catch(() => null),
      aiAnalyticsService.getDashboard().catch(() => null),
    ])
      .then(([cov, dash]) => {
        setCoverage(cov);
        setPairs(dash?.duplicateQuestions?.pairs || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const backfill = async () => {
    setBusy(true);
    try {
      const res = await knowledgeLibraryAiService.backfillEmbeddings({ limit: 40 });
      toast.success(`Embedded ${res.embedded} / ${res.processed}`);
      if (res.coverage) setCoverage(res.coverage);
      load();
    } catch {
      toast.error("Backfill failed — is the embed engine online?");
    } finally {
      setBusy(false);
    }
  };

  const pct =
    coverage && coverage.total > 0 ? Math.round((coverage.with_embedding / coverage.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/superadmin/knowledge-library/ai" className="text-xs text-admin-accent hover:underline">
          ← AI Features
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">Embeddings & Duplicates</h2>
        <p className="text-sm text-gray-500">Coverage for semantic search and near-duplicate pairs (≥95% similarity).</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card">
            <p className="text-xs uppercase text-gray-400">Coverage</p>
            <p className="text-3xl font-semibold text-gray-900 mt-1">{pct}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {coverage?.with_embedding ?? 0} / {coverage?.total ?? 0} active questions embedded
            </p>
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-navy-900" style={{ width: `${pct}%` }} />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={backfill}
              className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Backfilling…" : "Backfill next 40"}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Likely duplicates ({pairs.length})</h3>
            {pairs.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center border border-dashed rounded-xl">No high-similarity pairs in scan window.</p>
            ) : (
              <div className="space-y-2">
                {pairs.map((p) => (
                  <div key={`${p.a.id}-${p.b.id}`} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                    <p className="text-xs text-amber-700 mb-2">{(p.similarity * 100).toFixed(1)}% similar</p>
                    <p className="text-gray-800 line-clamp-2">{p.a.question_text}</p>
                    <p className="text-gray-500 line-clamp-2 mt-2 border-t border-gray-100 pt-2">{p.b.question_text}</p>
                    <div className="mt-2 flex gap-3 text-xs">
                      <Link to={`/app/superadmin/knowledge-library/ai/duplicates?id=${p.a.id}`} className="text-admin-accent hover:underline">
                        Scan A →
                      </Link>
                      <Link to={`/app/superadmin/knowledge-library/ai/related?id=${p.a.id}`} className="text-admin-accent hover:underline">
                        Related →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
