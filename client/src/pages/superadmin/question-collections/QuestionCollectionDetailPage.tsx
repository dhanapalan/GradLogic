// =============================================================================
// Question Collection Detail — add/remove Question Bank rows by ID.
// Never duplicates question content; only membership links.
// =============================================================================

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Wand2,
  Pencil,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import questionCollectionsService, {
  PHASE1_COLLECTION_DOMAINS,
  type QuestionCollectionDetail,
} from "../../../services/questionCollectionsService";
import questionBankService, { Question } from "../../../services/questionBankService";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function domainLabel(category: string | null) {
  if (!category) return null;
  return PHASE1_COLLECTION_DOMAINS.find((d) => d.value === category)?.label || category;
}

export default function QuestionCollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<QuestionCollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Question[]>([]);
  const [searching, setSearching] = useState(false);
  const [filling, setFilling] = useState(false);
  const [pasteId, setPasteId] = useState("");
  const [addingId, setAddingId] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    if (!collectionId) return;
    setLoading(true);
    questionCollectionsService
      .get(collectionId)
      .then((c) => {
        setCollection(c);
        setEditForm({
          name: c.name,
          description: c.description || "",
          category: c.category || "aptitude",
        });
      })
      .catch(() => toast.error("Failed to load collection"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [collectionId]);

  const runSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const { questions } = await questionBankService.searchQuestions({
        search,
        category: collection?.category || undefined,
        status: "published",
        limit: 10,
      });
      setResults(questions);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const addQuestion = async (questionId: string) => {
    if (!collectionId) return;
    try {
      const res = await questionCollectionsService.addQuestions(collectionId, [questionId]);
      if (res.added > 0) toast.success("Added to collection");
      else if (res.skipped) toast.success("Already in this collection");
      else if (res.missing) toast.error("Question not found in bank");
      else toast.success("No change");
      load();
    } catch {
      toast.error("Failed to add");
    }
  };

  const addByPaste = async () => {
    const id = pasteId.trim();
    if (!UUID_RE.test(id)) {
      toast.error("Enter a valid Question Bank UUID");
      return;
    }
    setAddingId(true);
    try {
      await addQuestion(id);
      setPasteId("");
    } finally {
      setAddingId(false);
    }
  };

  const removeQuestion = async (questionId: string) => {
    if (!collectionId) return;
    try {
      await questionCollectionsService.removeQuestion(collectionId, questionId);
      toast.success("Removed from collection");
      load();
    } catch {
      toast.error("Failed to remove");
    }
  };

  const fillFromBank = async () => {
    if (!collectionId) return;
    setFilling(true);
    try {
      const res = await questionCollectionsService.fillFromBank(collectionId, 40);
      toast.success(
        res.added > 0
          ? `Added ${res.added} question(s) from Question Bank`
          : "No more matching bank questions to add"
      );
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Fill from bank failed";
      toast.error(msg);
    } finally {
      setFilling(false);
    }
  };

  const saveMeta = async () => {
    if (!collectionId) return;
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await questionCollectionsService.update(collectionId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
      });
      setCollection((prev) =>
        prev
          ? {
              ...prev,
              name: updated.name,
              description: updated.description,
              category: updated.category,
            }
          : prev
      );
      toast.success("Collection updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const deleteCollection = async () => {
    if (!collectionId || !collection) return;
    if (
      !confirm(
        `Delete “${collection.name}”? Question Bank rows are kept — only this collection grouping is removed.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await questionCollectionsService.remove(collectionId);
      toast.success("Collection deleted");
      navigate("/app/superadmin/question-collections");
    } catch {
      toast.error("Failed to delete");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!collection) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-gray-400">Collection not found.</div>
    );
  }

  const inCollection = new Set(collection.questions.map((q) => q.id));
  const label = domainLabel(collection.category);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link
        to="/app/superadmin/question-collections"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Collections
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2 max-w-xl">
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
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
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Description"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveMeta()}
                  className="rounded-lg bg-navy-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {label ? (
                <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                  {label} · Reusable · Bank IDs only
                </p>
              ) : null}
              <h1 className="text-xl font-semibold text-gray-900">{collection.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {collection.description || "No description"} · {collection.questions.length}{" "}
                question(s)
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : null}
          <button
            type="button"
            disabled={filling || !collection.category}
            onClick={() => void fillFromBank()}
            title={
              collection.category
                ? "Add up to 40 published questions from bank by domain"
                : "Set a domain on the collection first"
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            <Wand2 className="w-4 h-4" />
            {filling ? "Filling…" : "Fill 40 from bank"}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void deleteCollection()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5 mb-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Add from Question Bank</h3>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder="Search question bank…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
        {results.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {results.map((q) => (
              <div key={q.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-800 line-clamp-1">{q.question_text}</span>
                {inCollection.has(q.id) ? (
                  <span className="shrink-0 text-xs text-gray-400">Already added</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void addQuestion(q.id)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Or paste Question Bank UUID
          </label>
          <div className="flex gap-2">
            <input
              value={pasteId}
              onChange={(e) => setPasteId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
            <button
              type="button"
              disabled={addingId}
              onClick={() => void addByPaste()}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40"
            >
              {addingId ? "Adding…" : "Add ID"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900">
            In this collection ({collection.questions.length})
          </h3>
        </div>
        {collection.questions.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">
            No questions yet — Fill from bank or search above to link bank rows.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {collection.questions.map((q) => (
              <div key={q.id} className="p-4 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-gray-800">{q.question_text}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">{q.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeQuestion(q.id)}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                  title="Unlink from collection"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
