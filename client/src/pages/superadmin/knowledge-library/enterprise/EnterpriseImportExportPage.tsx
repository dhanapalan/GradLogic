import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileUp } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../../../stores/authStore";
import knowledgeLibraryEnterpriseService from "../../../../services/knowledgeLibraryEnterpriseService";
import { CATEGORY_OPTIONS } from "../../../../services/knowledgeLibraryService";

export default function EnterpriseImportExportPage() {
  const token = useAuthStore((s) => s.token);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("published");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const path = knowledgeLibraryEnterpriseService.exportCsvUrl({
        category: category || undefined,
        status: status || undefined,
        type: type || undefined,
        search: search || undefined,
      });
      // Match axios baseURL construction (dev uses absolute API host; relative /api is for Vite proxy hosts).
      const isLocalhost = window.location.hostname === "localhost";
      const apiRoot =
        import.meta.env.VITE_API_URL ||
        (isLocalhost ? "http://localhost:5050" : "");
      const url = apiRoot
        ? `${apiRoot.replace(/\/$/, "")}${path.startsWith("/api") ? path : `/api${path}`}`
        : path;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `knowledge-export.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/superadmin/knowledge-library/enterprise" className="text-xs text-admin-accent hover:underline">
          ← Enterprise
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">Import / Export</h2>
        <p className="text-sm text-gray-500">Server CSV export with filters, plus existing import pipelines.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Download className="w-4 h-4" /> Export questions (CSV)
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">All subjects</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">All types</option>
            <option value="multiple_choice">MCQ</option>
            <option value="coding_challenge">Coding</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search text…"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={download}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Exporting…" : "Download CSV"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileUp className="w-4 h-4" /> Import
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <LinkCard href="/app/superadmin/question-bank/import-books" title="Import books / PDF" desc="Parse packs and PDFs into the question bank." />
          <LinkCard href="/app/superadmin/learning-companion/studio" title="Content Studio" desc="AI generation and import into review." />
          <LinkCard href="/app/superadmin/question-bank" title="CSV import (legacy)" desc="Client-side CSV import on Question Bank." />
          <LinkCard href="/app/superadmin/knowledge-library/create" title="Create wizard" desc="Guided multi-asset creation." />
        </div>
      </div>
    </div>
  );
}

function LinkCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link to={href} className="rounded-lg border border-gray-200 p-3 hover:border-gray-300 block">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}
