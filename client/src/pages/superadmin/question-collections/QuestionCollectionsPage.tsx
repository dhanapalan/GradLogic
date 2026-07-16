// =============================================================================
// Assessment Hub · Question Collections — reusable groups from Question Bank
// Links reference bank rows by ID (no duplicated questions).
// Downstream consumers: Assessment Builder, Practice Sets, Mock Tests.
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Layers,
  Plus,
  Sprout,
  Loader2,
  Search,
  Pencil,
  Trash2,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import questionCollectionsService, {
  PHASE1_COLLECTION_DOMAINS,
  type QuestionCollection,
} from "../../../services/questionCollectionsService";
import { PHASE1_PLACEMENT_TRACK } from "../../../lib/phase1PlacementDomains";

function domainLabel(category: string | null) {
  if (!category) return "Uncategorized";
  return PHASE1_COLLECTION_DOMAINS.find((d) => d.value === category)?.label || category;
}

export default function QuestionCollectionsPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [collections, setCollections] = useState<QuestionCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState(() => searchParams.get("domain") || "");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: searchParams.get("domain") || "aptitude",
  });

  const [editing, setEditing] = useState<QuestionCollection | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", category: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    questionCollectionsService
      .list({
        category: domain || undefined,
        search: search.trim() || undefined,
      })
      .then(setCollections)
      .catch(() => toast.error("Failed to load collections"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, search]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const c = await questionCollectionsService.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category || undefined,
      });
      toast.success("Collection created");
      setShowCreate(false);
      setForm({ name: "", description: "", category: "aptitude" });
      navigate(`/app/superadmin/question-collections/${c.id}`);
    } catch {
      toast.error("Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await questionCollectionsService.seedPhase1();
      toast.success(
        res.created_count > 0
          ? `Seeded ${res.created_count} Placement Preparation collections`
          : "Placement Preparation Phase-1 collections already present"
      );
      load();
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const openEdit = (c: QuestionCollection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(c);
    setEditForm({
      name: c.name,
      description: c.description || "",
      category: c.category || "aptitude",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingEdit(true);
    try {
      await questionCollectionsService.update(editing.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
      });
      toast.success("Collection updated");
      setEditing(null);
      load();
    } catch {
      toast.error("Failed to update collection");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (c: QuestionCollection, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `Delete collection “${c.name}”? Linked bank questions are not deleted — only the grouping.`
      )
    ) {
      return;
    }
    setDeletingId(c.id);
    try {
      await questionCollectionsService.remove(c.id);
      toast.success("Collection deleted");
      load();
    } catch {
      toast.error("Failed to delete collection");
    } finally {
      setDeletingId(null);
    }
  };

  const body = (
    <div className={embedded ? "space-y-5" : "max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6"}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">Same Assessment Hub collections (shared table).</p>
          <Link
            to="/app/superadmin/question-collections"
            className="text-xs text-admin-accent hover:underline"
          >
            Open Assessment Hub view →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDomain("")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
              !domain
                ? "bg-navy-900 text-white border-navy-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            All
          </button>
          {PHASE1_COLLECTION_DOMAINS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDomain(d.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                domain === d.value
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={seeding}
            onClick={() => void seed()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            <Sprout className="w-4 h-4" />
            {seeding ? "Seeding…" : "Seed Placement Prep"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" /> New Collection
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collections by name or description…"
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/20"
        />
      </div>

      <section className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Reuse Question Bank rows</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Collections store question IDs only — never duplicate bank content. Builder, Practice,
            and Mock attach these packs later.
          </p>
        </div>
        <Link
          to="/app/superadmin/question-bank/browse"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-navy-900/30"
        >
          <BookOpen className="w-4 h-4" />
          Browse Question Bank
        </Link>
      </section>

      {showCreate && (
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New reusable collection</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Name * (e.g. Python Basics)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {PHASE1_COLLECTION_DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200/70 bg-white shadow-admin-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">
            No collections yet. Seed Placement Preparation (Aptitude, Logical Reasoning, Python,
            Java, AI Fundamentals) or create one.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {collections.map((c) => (
              <li key={c.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => navigate(`/app/superadmin/question-collections/${c.id}`)}
                  className="flex-1 text-left px-4 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      {domainLabel(c.category)} · Reusable
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{c.name}</p>
                    {c.description ? (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                    {c.question_count} question{c.question_count === 1 ? "" : "s"}
                  </span>
                </button>
                <div className="flex items-center gap-1 pr-3 shrink-0">
                  <button
                    type="button"
                    title="Edit"
                    onClick={(e) => openEdit(c, e)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-navy-900"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={deletingId === c.id}
                    onClick={(e) => void handleDelete(c, e)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Pipeline: Question Bank →{" "}
        <strong className="font-medium text-gray-500">Collections</strong> → Practice / Mock /
        Assessment Builder.
      </p>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Edit collection</h3>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Name"
            />
            <select
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {PHASE1_COLLECTION_DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Description"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void saveEdit()}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · {PHASE1_PLACEMENT_TRACK.title} (Phase 1)
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="w-6 h-6 text-navy-900" />
                Question Collections
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Named reusable packs that reference Question Bank IDs. Seed Aptitude, Logical
                Reasoning, Python, Java, and AI Fundamentals for Placement Preparation.
              </p>
            </div>
            <Link
              to="/app/superadmin/question-bank"
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700"
            >
              Question Bank
            </Link>
          </div>
        </div>
      </div>
      {body}
    </div>
  );
}
