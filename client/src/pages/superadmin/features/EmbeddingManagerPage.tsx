// =============================================================================
// Embedding Manager — coverage of question_bank search embeddings.
// =============================================================================

import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import aiAnalytics from "../../../services/aiAnalyticsService";
import { PageHeader, StatTile } from "./FeatureUi";

export default function EmbeddingManagerPage() {
  const [loading, setLoading] = useState(true);
  const [embedded, setEmbedded] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    aiAnalytics
      .getDashboard()
      .then((data) => {
        setEmbedded(data.duplicateQuestions?.totalEmbedded ?? 0);
        setScanned(data.duplicateQuestions?.scannedCount ?? 0);
        setDuplicates(data.duplicateQuestions?.pairs?.length ?? 0);
        setTotalQuestions(
          (data.knowledgeCoverage || []).reduce((sum, c) => sum + (c.totalQuestions || 0), 0)
        );
      })
      .catch(() => toast.error("Failed to load embedding stats"))
      .finally(() => setLoading(false));
  }, []);

  const coverage =
    totalQuestions > 0 ? Math.round((embedded / totalQuestions) * 100) : embedded > 0 ? null : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Cpu}
        title="Embedding Manager"
        description="Search-embedding coverage used for AI search, dedup, and related-content links."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Questions (catalog)" value={totalQuestions} />
        <StatTile label="With embeddings" value={embedded} />
        <StatTile label="Coverage" value={coverage == null ? "—" : `${coverage}%`} />
        <StatTile label="Near-duplicate pairs" value={duplicates} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 space-y-2">
        <p>
          Embeddings are generated when content is uploaded through{" "}
          <a href="/app/superadmin/learning-companion/studio" className="text-admin-accent hover:underline">
            Content Generator
          </a>{" "}
          and backfilled lazily during AI search.
        </p>
        <p>
          Last duplicate scan sampled <span className="font-medium text-gray-900">{scanned}</span> embedded
          questions and found <span className="font-medium text-gray-900">{duplicates}</span> similar pairs.
        </p>
        <p className="text-xs text-gray-400">
          Full re-embed / batch backfill controls can be added here once a dedicated admin API exists.
        </p>
      </div>
    </div>
  );
}
