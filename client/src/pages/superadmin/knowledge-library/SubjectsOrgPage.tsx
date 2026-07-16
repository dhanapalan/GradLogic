// =============================================================================
// Subjects CRUD (under Categories)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeTaxonomyService, {
  type TaxonomyCategory,
  type TaxonomySubject,
} from "../../../services/knowledgeTaxonomyService";

export default function SubjectsOrgPage() {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      knowledgeTaxonomyService.listCategories(),
      knowledgeTaxonomyService.listSubjects(),
    ])
      .then(([cats, subs]) => {
        setCategories(cats);
        setSubjects(subs);
        if (!categoryId && cats[0]) setCategoryId(cats[0].id);
      })
      .catch(() => toast.error("Failed to load subjects"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!categoryId || !name.trim()) {
      toast.error("Category and name required");
      return;
    }
    setBusy(true);
    try {
      await knowledgeTaxonomyService.createSubject({
        category_id: categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Subject created");
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
    if (!confirm("Deactivate this subject?")) return;
    try {
      await knowledgeTaxonomyService.deleteSubject(id);
      toast.success("Subject removed");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/superadmin/knowledge-library/organization" className="text-xs text-admin-accent hover:underline">
          ← Organization
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Layers className="w-5 h-5" /> Subjects
        </h2>
        <p className="text-sm text-gray-500">Mid-level nodes under a category (e.g. Programming → Python).</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card space-y-3">
        <p className="text-sm font-medium text-gray-900">New subject</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Subject name"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={create}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add subject
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">{s.category_name}</p>
                <h3 className="font-medium text-gray-900">{s.name}</h3>
                {s.description ? <p className="text-sm text-gray-500 mt-1">{s.description}</p> : null}
                <p className="text-xs text-gray-400 mt-1">{Number(s.topic_count)} topics</p>
              </div>
              <button type="button" onClick={() => remove(s.id)} className="p-2 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
