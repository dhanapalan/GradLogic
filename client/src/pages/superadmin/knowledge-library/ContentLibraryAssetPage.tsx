// =============================================================================
// Knowledge Assets — content_library_items wrappers (Sprint 2)
// Cases · Interview · Documents (+ create/archive)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Loader2, Plus, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, {
  type ContentLibraryItem,
  type ContentLibraryType,
} from "../../../services/superadminFeaturesService";
import KnowledgeFilterBar, { EMPTY_FILTERS, type KnowledgeFilters } from "./KnowledgeFilterBar";

interface Meta {
  title: string;
  description: string;
  icon: LucideIcon;
  contentType: ContentLibraryType;
  placeholder: string;
}

export function ContentLibraryAssetPage({ meta }: { meta: Meta }) {
  const Icon = meta.icon;
  const [filters, setFilters] = useState<KnowledgeFilters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const load = () => {
    setLoading(true);
    superadminFeaturesService
      .listContentLibrary({
        content_type: meta.contentType,
        search: debounced || undefined,
        status: filters.status || "published",
      })
      .then((items) => {
        let next = items;
        if (filters.category) {
          next = items.filter((i) => i.category === filters.category || i.category?.includes(filters.category));
        }
        if (filters.difficulty) {
          next = next.filter((i) => i.difficulty === filters.difficulty);
        }
        setRows(next);
      })
      .catch(() => {
        toast.error(`Failed to load ${meta.title.toLowerCase()}`);
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.contentType, debounced, filters.category, filters.difficulty, filters.status]);

  const create = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      await superadminFeaturesService.createContentLibraryItem({
        content_type: meta.contentType,
        title: title.trim(),
        body: body.trim(),
        category: filters.category || category,
      });
      toast.success("Created");
      setCreating(false);
      setTitle("");
      setBody("");
      load();
    } catch {
      toast.error("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    try {
      await superadminFeaturesService.archiveContentLibraryItem(id);
      toast.success("Archived");
      load();
    } catch {
      toast.error("Archive failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Icon className="w-5 h-5" /> {meta.title}
          </h2>
          <p className="text-sm text-gray-500">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/app/superadmin/knowledge-library/create"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-accent hover:underline"
          >
            AI wizard
          </Link>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" /> Add manual
          </button>
        </div>
      </div>

      <KnowledgeFilterBar
        value={filters}
        onChange={setFilters}
        showType={false}
        searchPlaceholder={`Search ${meta.title.toLowerCase()}…`}
      />

      {creating && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-admin-card">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={meta.placeholder}
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-xl">
          No {meta.title.toLowerCase()} yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.category} · {item.difficulty} · {item.status}
                  </p>
                  {item.body ? (
                    <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">{item.body}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => archive(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
