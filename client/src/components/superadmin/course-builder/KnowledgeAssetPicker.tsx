// =============================================================================
// Knowledge Asset Picker — search KL and attach to a module (no content authoring)
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import courseBuilderService, {
  ASSET_ROLES,
  type KnowledgeSearchHit,
  type PickerTab,
} from "../../../services/courseBuilderService";

const TABS: { id: PickerTab; label: string }[] = [
  { id: "questions", label: "Questions" },
  { id: "coding", label: "Coding" },
  { id: "flashcards", label: "Flashcards" },
  { id: "content", label: "Content" },
  { id: "voice", label: "Voice" },
];

interface KnowledgeAssetPickerProps {
  moduleId: string;
  category?: string;
  attachedKeys: Set<string>;
  onAttached: () => void;
}

function assetKey(type: string, id: string, role: string) {
  return `${type}:${id}:${role}`;
}

export default function KnowledgeAssetPicker({
  moduleId,
  category,
  attachedKeys,
  onAttached,
}: KnowledgeAssetPickerProps) {
  const [tab, setTab] = useState<PickerTab>("questions");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleById, setRoleById] = useState<Record<string, string>>({});
  const [attaching, setAttaching] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    courseBuilderService
      .searchKnowledge(tab, { search: debounced, category, limit: 40 })
      .then((rows) => {
        setHits(rows);
        setRoleById((prev) => {
          const next = { ...prev };
          for (const h of rows) {
            if (!next[h.id]) next[h.id] = h.default_role;
          }
          return next;
        });
      })
      .catch(() => {
        toast.error("Failed to search Knowledge Library");
        setHits([]);
      })
      .finally(() => setLoading(false));
  }, [tab, debounced, category]);

  useEffect(() => {
    load();
  }, [load]);

  const attach = async (hit: KnowledgeSearchHit) => {
    const role = roleById[hit.id] || hit.default_role;
    const key = assetKey(hit.asset_type, hit.id, role);
    if (attachedKeys.has(key)) {
      toast.error("Already attached with this role");
      return;
    }
    setAttaching(hit.id);
    try {
      await courseBuilderService.attachAsset(moduleId, {
        asset_type: hit.asset_type,
        asset_id: hit.id,
        role,
        sort_order: attachedKeys.size,
        meta: { title: hit.title },
      });
      toast.success("Attached");
      onAttached();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Attach failed";
      toast.error(msg);
    } finally {
      setAttaching(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-slate-50/80 overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold text-gray-700">Attach from Knowledge Library</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Search and map existing assets — nothing is created here.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-2.5 py-1.5 text-xs border-b-2 ${
              tab === t.id
                ? "border-navy-900 font-medium text-navy-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : hits.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">No assets match this search.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto space-y-2">
            {hits.map((hit) => {
              const role = roleById[hit.id] || hit.default_role;
              const already = attachedKeys.has(assetKey(hit.asset_type, hit.id, role));
              return (
                <li
                  key={hit.id}
                  className="rounded-lg border border-gray-200 bg-white p-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 line-clamp-2">{hit.title}</p>
                    {hit.subtitle ? (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{hit.subtitle}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={role}
                      onChange={(e) =>
                        setRoleById((prev) => ({ ...prev, [hit.id]: e.target.value }))
                      }
                      className="rounded border border-gray-200 text-xs px-1.5 py-1 bg-white"
                    >
                      {ASSET_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={already || attaching === hit.id}
                      onClick={() => attach(hit)}
                      className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-40"
                    >
                      {attaching === hit.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      {already ? "Attached" : "Attach"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export { assetKey };
