import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeLibraryEnterpriseService, {
  type VersionRow,
} from "../../../../services/knowledgeLibraryEnterpriseService";
import contentImproverService from "../../../../services/contentImproverService";

export default function EnterpriseVersionsPage() {
  const [status, setStatus] = useState("proposed");
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    knowledgeLibraryEnterpriseService
      .listVersions(status || undefined)
      .then(setRows)
      .catch(() => toast.error("Failed to load versions"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  const apply = async (versionId: string) => {
    setBusy(versionId);
    try {
      await contentImproverService.applyVersion(versionId);
      toast.success("Version applied");
      load();
    } catch {
      toast.error("Apply failed");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (versionId: string) => {
    setBusy(versionId);
    try {
      await contentImproverService.rejectVersion(versionId);
      toast.success("Version rejected");
      load();
    } catch {
      toast.error("Reject failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title="Version History"
        blurb="Proposed AI improvements stored without overwriting the live knowledge object until you apply."
      />

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="proposed">Proposed</option>
          <option value="applied">Applied</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
        <Link
          to="/app/superadmin/ai-studio/content-improver"
          className="text-sm text-admin-accent hover:underline"
        >
          Open Content Improver →
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed rounded-xl">No versions in this view.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((v) => (
            <div key={v.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <History className="w-3 h-3" /> {v.improvement_type} · {v.status} · {v.category}
                  </p>
                  <p className="text-sm text-gray-900 mt-1 line-clamp-2">{v.question_text}</p>
                  {v.change_summary ? (
                    <p className="text-xs text-gray-500 mt-1">{v.change_summary}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/app/superadmin/learning-companion/improve/${v.question_id}`}
                    className="text-xs font-medium text-admin-accent hover:underline"
                  >
                    Open →
                  </Link>
                  {v.status === "proposed" && (
                    <>
                      <button
                        type="button"
                        disabled={busy === v.id}
                        onClick={() => apply(v.id)}
                        className="text-xs font-medium text-emerald-700 disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        disabled={busy === v.id}
                        onClick={() => reject(v.id)}
                        className="text-xs font-medium text-rose-600 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <Link to="/app/superadmin/knowledge-library/enterprise" className="text-xs text-admin-accent hover:underline">
        ← Enterprise
      </Link>
      <h2 className="mt-2 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{blurb}</p>
    </div>
  );
}
