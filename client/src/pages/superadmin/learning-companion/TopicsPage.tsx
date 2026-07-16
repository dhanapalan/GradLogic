import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";

export default function TopicsPage() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Array<{ tag: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [sampleSize, setSampleSize] = useState(0);

  useEffect(() => {
    questionBankService
      .getFacets()
      .then((f) => {
        setTopics(f.topics);
        setSampleSize(f.sample.length);
      })
      .catch(() => toast.error("Failed to load topics"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Topics</h2>
        <p className="text-gray-500 mt-1">
          Fine-grained tags across the knowledge base
          {sampleSize > 0 && <span className="text-gray-400"> · derived from {sampleSize} items</span>}.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading…</div>
      ) : topics.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-gray-200/70">
          <p className="text-gray-500">No topic tags found yet. Tag questions to build this view out.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topics.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => navigate(`/app/superadmin/knowledge-library/all?tag=${encodeURIComponent(tag)}`)}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200/70 shadow-admin-card px-4 py-3.5 text-left hover:border-admin-accent/40 hover:shadow-md transition-all"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Hash className="w-4 h-4 text-gray-400" />
                {tag}
              </span>
              <span className="flex items-center gap-2 text-sm text-gray-500">
                {count} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
