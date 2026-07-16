// =============================================================================
// Topics CRUD + promote tags
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Hash, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";
import knowledgeTaxonomyService, {
  type TaxonomySubject,
  type TaxonomyTopic,
} from "../../../services/knowledgeTaxonomyService";

export default function TopicsOrgPage() {
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectId, setSubjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      knowledgeTaxonomyService.listSubjects(),
      knowledgeTaxonomyService.listTopics({ search: search || undefined }),
    ])
      .then(([subs, tops]) => {
        setSubjects(subs);
        setTopics(tops);
        if (!subjectId && subs[0]) setSubjectId(subs[0].id);
      })
      .catch(() => toast.error("Failed to load topics"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!subjectId || !name.trim()) {
      toast.error("Subject and name required");
      return;
    }
    setBusy(true);
    try {
      await knowledgeTaxonomyService.createTopic({
        subject_id: subjectId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Topic created");
      setName("");
      setDescription("");
      load();
    } catch {
      toast.error("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this topic?")) return;
    try {
      await knowledgeTaxonomyService.deleteTopic(id);
      toast.success("Topic removed");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const promoteTopTags = async () => {
    if (!subjectId) {
      toast.error("Pick a subject first");
      return;
    }
    setPromoting(true);
    try {
      const facets = await questionBankService.getFacets();
      const tags = facets.topics.slice(0, 12).map((t) => t.tag);
      if (tags.length === 0) {
        toast.error("No tags to promote");
        return;
      }
      await knowledgeTaxonomyService.promoteTags(subjectId, tags);
      toast.success(`Promoted ${tags.length} tags into topics`);
      load();
    } catch {
      toast.error("Promote failed");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/app/superadmin/knowledge-library/organization" className="text-xs text-admin-accent hover:underline">
            ← Organization
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Hash className="w-5 h-5" /> Topics
          </h2>
          <p className="text-sm text-gray-500">
            Leaf nodes that own lessons, questions, flashcards, and more.
          </p>
        </div>
        <button
          type="button"
          disabled={promoting}
          onClick={promoteTopTags}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Wand2 className="w-4 h-4" /> Promote top tags → topics
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card space-y-3">
        <p className="text-sm font-medium text-gray-900">New topic</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.category_name} / {s.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Topic name (e. g. Functions)"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={create}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add topic
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter topics…"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={load} className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white">
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : topics.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed rounded-xl">No topics yet.</p>
      ) : (
        <div className="space-y-2">
          {topics.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">
                  {t.category_name} → {t.subject_name}
                </p>
                <Link
                  to={`/app/superadmin/knowledge-library/topics/${t.id}`}
                  className="font-medium text-gray-900 hover:text-admin-accent"
                >
                  {t.name}
                </Link>
                <p className="text-xs text-gray-400 mt-1">
                  {Number(t.question_count)} questions · {Number(t.flashcard_count)} flashcards ·{" "}
                  {Number(t.content_count)} content
                </p>
              </div>
              <button type="button" onClick={() => remove(t.id)} className="p-2 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
