import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Binary,
  FileUp,
  History,
  Layers,
  Loader2,
  Shield,
} from "lucide-react";
import knowledgeLibraryEnterpriseService, {
  type EnterpriseSummary,
} from "../../../../services/knowledgeLibraryEnterpriseService";

const BASE = "/app/superadmin/knowledge-library/enterprise";

const TOOLS = [
  {
    name: "Version History",
    desc: "Review proposed AI improvements before they hit the live bank.",
    href: `${BASE}/versions`,
    icon: History,
  },
  {
    name: "Archive",
    desc: "Browse archived and soft-deleted assets; restore when needed.",
    href: `${BASE}/archive`,
    icon: Archive,
  },
  {
    name: "Bulk Operations",
    desc: "Publish, archive, and assign topics across many questions.",
    href: `${BASE}/bulk`,
    icon: Layers,
  },
  {
    name: "Import / Export",
    desc: "CSV export plus deep links to books, PDF, and Content Studio import.",
    href: `${BASE}/import-export`,
    icon: FileUp,
  },
  {
    name: "Analytics",
    desc: "Knowledge health, duplicates, usage, and quality flags.",
    href: `${BASE}/analytics`,
    icon: BarChart3,
  },
  {
    name: "Embeddings",
    desc: "Coverage and backfill (Sprint 4 AI tool).",
    href: "/app/superadmin/knowledge-library/ai/embeddings",
    icon: Binary,
  },
];

export default function EnterpriseHubPage() {
  const [summary, setSummary] = useState<EnterpriseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeLibraryEnterpriseService
      .summary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="w-5 h-5" /> Enterprise
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Version history, archive/restore, bulk ops, import/export, and analytics for the Knowledge Library.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Published" value={summary.published} />
          <Tile label="Archived" value={summary.archived} />
          <Tile label="Soft-deleted" value={summary.deleted} />
          <Tile label="Proposed versions" value={summary.proposedVersions} />
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              to={tool.href}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-navy-900/[0.06]">
                  <Icon className="w-4 h-4 text-navy-900" />
                </div>
                <h3 className="font-medium text-gray-900 text-sm">{tool.name}</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{tool.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
