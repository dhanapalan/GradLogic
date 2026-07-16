import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";

// Bloom's Taxonomy — the cognitive-skill dimension already captured per
// question (`bloom_level`). Ordered low → high cognitive demand.
const SKILL_META: Record<string, { label: string; blurb: string }> = {
  remember: { label: "Remember", blurb: "Recall facts and basic concepts" },
  understand: { label: "Understand", blurb: "Explain ideas or concepts" },
  apply: { label: "Apply", blurb: "Use information in new situations" },
  analyze: { label: "Analyze", blurb: "Draw connections among ideas" },
  evaluate: { label: "Evaluate", blurb: "Justify a stand or decision" },
  create: { label: "Create", blurb: "Produce new or original work" },
};

export default function SkillsPage() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Array<{ bloomLevel: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    questionBankService
      .getFacets()
      .then((f) => setSkills(f.skills))
      .catch(() => toast.error("Failed to load skills"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Skills</h2>
        <p className="text-gray-500 mt-1">Cognitive skill levels assessed (Bloom's Taxonomy).</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(SKILL_META).map(([key, meta]) => {
            const count = skills.find((s) => s.bloomLevel === key)?.count ?? 0;
            return (
              <button
                key={key}
                onClick={() => navigate(`/app/superadmin/knowledge-library/assets/questions?bloom=${key}`)}
                className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5 text-left hover:border-admin-accent/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg p-2.5 bg-purple-50 text-purple-700">
                    <Brain className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-display font-semibold text-gray-900">{count}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mt-3">{meta.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{meta.blurb}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-admin-accent mt-3">
                  View questions <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
