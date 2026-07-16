import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookMarked, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";

const SUBJECT_META: Record<string, { label: string; blurb: string }> = {
  aptitude: { label: "Aptitude", blurb: "Percentages, profit & loss, time-speed-distance" },
  reasoning: { label: "Reasoning", blurb: "Logical, verbal and analytical reasoning" },
  maths: { label: "Maths", blurb: "Algebra, number systems, geometry" },
  data_structures: { label: "Data Structures", blurb: "Arrays, trees, graphs, stacks & queues" },
  programming: { label: "Programming", blurb: "General programming and CS fundamentals" },
  python_coding: { label: "Python Coding", blurb: "Python-specific coding challenges" },
  java_coding: { label: "Java Coding", blurb: "Java-specific coding challenges" },
  data_science: { label: "Data Science", blurb: "Statistics, ML fundamentals, data handling" },
};

export default function SubjectsPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Array<{ category: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    questionBankService
      .getSubjectCounts()
      .then(setCounts)
      .catch(() => toast.error("Failed to load subjects"))
      .finally(() => setLoading(false));
  }, []);

  const openSubject = (category: string) => {
    navigate(`/app/superadmin/knowledge-library/assets/questions?category=${category}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Subjects</h2>
        <p className="text-gray-500 mt-1">Browse the knowledge base by subject area.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(SUBJECT_META).map(([key, meta]) => {
            const count = counts.find((c) => c.category === key)?.count ?? 0;
            return (
              <button
                key={key}
                onClick={() => openSubject(key)}
                className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5 text-left hover:border-admin-accent/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg p-2.5 bg-navy-900/[0.06] text-navy-900">
                    <BookMarked className="w-5 h-5" />
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
