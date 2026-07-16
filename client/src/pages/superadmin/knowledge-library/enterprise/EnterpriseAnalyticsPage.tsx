import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import aiAnalyticsService, { type AiAnalyticsDashboard } from "../../../../services/aiAnalyticsService";
import knowledgeLibraryAiService from "../../../../services/knowledgeLibraryAiService";

export default function EnterpriseAnalyticsPage() {
  const [dash, setDash] = useState<AiAnalyticsDashboard | null>(null);
  const [coverage, setCoverage] = useState<{ total: number; with_embedding: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      aiAnalyticsService.getDashboard().catch(() => null),
      knowledgeLibraryAiService.embeddingCoverage().catch(() => null),
    ])
      .then(([d, c]) => {
        setDash(d);
        setCoverage(c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  const embedPct =
    coverage && coverage.total > 0 ? Math.round((coverage.with_embedding / coverage.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/superadmin/knowledge-library/enterprise" className="text-xs text-admin-accent hover:underline">
          ← Enterprise
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">Enterprise Analytics</h2>
        <p className="text-sm text-gray-500">Knowledge health snapshot composed from AI Analytics + embeddings.</p>
        <Link to="/app/superadmin/learning-companion/analytics" className="text-sm text-admin-accent hover:underline mt-1 inline-block">
          Full AI Analytics →
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Embedding coverage" value={`${embedPct}%`} />
        <Tile label="Duplicate pairs" value={String(dash?.duplicateQuestions?.pairs?.length || 0)} />
        <Tile label="Quality flags" value={String(dash?.questionQuality?.length || 0)} />
        <Tile label="AI usage" value={String(dash?.aiUsage?.total || 0)} />
      </div>

      {dash?.recommendations?.length ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recommendations</h3>
          <ul className="space-y-2">
            {dash.recommendations.map((r, i) => (
              <li key={i} className="text-sm text-gray-700 border-l-2 border-amber-400 pl-3">
                <span className="text-xs uppercase text-gray-400 mr-2">{r.severity}</span>
                {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dash?.weakSubjects?.length ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Weak subjects</h3>
          <div className="space-y-1">
            {dash.weakSubjects.slice(0, 8).map((s) => (
              <div key={s.category} className="flex justify-between text-sm">
                <span className="text-gray-700">{s.category.replace(/_/g, " ")}</span>
                <span className="text-gray-500">{Math.round(s.accuracy * 100)}% · {s.attempts} attempts</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
