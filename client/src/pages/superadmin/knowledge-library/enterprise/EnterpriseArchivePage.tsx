import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeLibraryEnterpriseService, {
  type ArchivedQuestion,
} from "../../../../services/knowledgeLibraryEnterpriseService";

type Tab = "archived" | "deleted" | "content";

export default function EnterpriseArchivePage() {
  const [tab, setTab] = useState<Tab>("archived");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ArchivedQuestion[]>([]);
  const [content, setContent] = useState<Array<{ id: string; title: string; content_type: string; category: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setSelected(new Set());
    const job =
      tab === "archived"
        ? knowledgeLibraryEnterpriseService.listArchived(search || undefined).then((d) => {
            setRows(d);
            setContent([]);
          })
        : tab === "deleted"
          ? knowledgeLibraryEnterpriseService.listDeleted(search || undefined).then((d) => {
              setRows(d);
              setContent([]);
            })
          : knowledgeLibraryEnterpriseService.listArchivedContent().then((d) => {
              setContent(d);
              setRows([]);
            });
    job.catch(() => toast.error("Failed to load archive")).finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restore = async () => {
    if (selected.size === 0) {
      toast.error("Select items first");
      return;
    }
    setBusy(true);
    try {
      if (tab === "content") {
        const res = await knowledgeLibraryEnterpriseService.restoreContent([...selected]);
        toast.success(`Restored ${res.restored}`);
      } else {
        const res = await knowledgeLibraryEnterpriseService.restore(
          [...selected],
          tab === "deleted" ? "undelete" : "unarchive"
        );
        toast.success(`Restored ${res.restored}`);
      }
      load();
    } catch {
      toast.error("Restore failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/superadmin/knowledge-library/enterprise" className="text-xs text-admin-accent hover:underline">
          ← Enterprise
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">Archive</h2>
        <p className="text-sm text-gray-500">
          Archived = status archived (reversible publish). Soft-deleted = deleted_at set (reversible restore).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "archived", label: "Archived questions" },
            { key: "deleted", label: "Soft-deleted" },
            { key: "content", label: "Archived content" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              tab === t.key ? "border-navy-900 bg-navy-900 text-white" : "border-gray-200 bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "content" && (
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button type="button" onClick={load} className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
            Search
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{selected.size} selected</p>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={restore}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Restore selected
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : tab === "content" ? (
        content.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {content.map((c) => (
              <label key={c.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <div>
                  <p className="text-[11px] uppercase text-gray-400">{c.content_type}</p>
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.category}</p>
                </div>
              </label>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-2">
          {rows.map((q) => (
            <label key={q.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
              <div className="min-w-0">
                <p className="text-sm text-gray-900 line-clamp-2">{q.question_text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {q.category} · {q.difficulty_level} · {q.status}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-400 py-12 text-center border border-dashed rounded-xl">Nothing here.</p>;
}
