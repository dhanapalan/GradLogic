// =============================================================================
// Skills Analytics — practice accuracy heatmap by category / difficulty.
// =============================================================================

import { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../lib/api";
import { EmptyState, PageHeader } from "./FeatureUi";

type Heatmap = Record<string, Record<string, number>>;

export default function SkillsAnalyticsPage() {
  const [heatmap, setHeatmap] = useState<Heatmap>({});
  const [rawCount, setRawCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/analytics/skill-heatmap")
      .then((res) => {
        setHeatmap(res.data?.data?.heatmap || {});
        setRawCount((res.data?.data?.raw || []).length);
      })
      .catch(() => toast.error("Failed to load skills analytics"))
      .finally(() => setLoading(false));
  }, []);

  const categories = Object.keys(heatmap).sort();
  const difficulties = ["easy", "medium", "hard"];

  const cellColor = (pct?: number) => {
    if (pct == null) return "bg-gray-50 text-gray-300";
    if (pct >= 75) return "bg-emerald-50 text-emerald-700";
    if (pct >= 50) return "bg-amber-50 text-amber-700";
    return "bg-red-50 text-red-700";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Layers}
        title="Skills"
        description="Practice accuracy by skill category and difficulty."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState message="No practice attempt data yet for a skills heatmap." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Category</th>
                {difficulties.map((d) => (
                  <th key={d} className="px-4 py-3 capitalize">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900 capitalize">
                    {cat.replace(/_/g, " ")}
                  </td>
                  {difficulties.map((d) => {
                    const pct = heatmap[cat]?.[d];
                    return (
                      <td key={d} className="px-4 py-3">
                        <span className={`inline-flex min-w-[3.5rem] justify-center rounded-md px-2 py-1 text-xs font-medium ${cellColor(pct)}`}>
                          {pct == null ? "—" : `${pct}%`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
            Based on {rawCount} category/difficulty buckets from completed practice sessions.
          </p>
        </div>
      )}
    </div>
  );
}
