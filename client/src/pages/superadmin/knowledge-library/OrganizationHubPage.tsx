// =============================================================================
// Knowledge Organization hub — Category → Subject → Topic tree (Sprint 3)
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  FolderTree,
  Hash,
  Layers,
  Loader2,
  Sparkles,
  Tags,
} from "lucide-react";
import toast from "react-hot-toast";
import knowledgeTaxonomyService, {
  type TaxonomyCategory,
  type TaxonomySubject,
  type TaxonomyTopic,
} from "../../../services/knowledgeTaxonomyService";

const BASE = "/app/superadmin/knowledge-library";

export default function OrganizationHubPage() {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  useEffect(() => {
    knowledgeTaxonomyService
      .getTree()
      .then((data) => {
        setCategories(data.categories || []);
        setSubjects(data.subjects || []);
        setTopics(data.topics || []);
        if (data.categories?.[0]) setOpenCategory(data.categories[0].id);
      })
      .catch(() => toast.error("Failed to load taxonomy tree — was migration 46 applied?"))
      .finally(() => setLoading(false));
  }, []);

  const subjectsByCat = useMemo(() => {
    const map = new Map<string, TaxonomySubject[]>();
    for (const s of subjects) {
      const list = map.get(s.category_id) || [];
      list.push(s);
      map.set(s.category_id, list);
    }
    return map;
  }, [subjects]);

  const topicsBySubject = useMemo(() => {
    const map = new Map<string, TaxonomyTopic[]>();
    for (const t of topics) {
      const list = map.get(t.subject_id) || [];
      list.push(t);
      map.set(t.subject_id, list);
    }
    return map;
  }, [topics]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FolderTree className="w-5 h-5" /> Knowledge Organization
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Category → Subject → Topic. Open a topic to see every related knowledge asset in one place.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { name: "Categories", href: `${BASE}/organization/categories`, icon: FolderTree, count: categories.length },
          { name: "Subjects", href: `${BASE}/organization/subjects`, icon: Layers, count: subjects.length },
          { name: "Topics", href: `${BASE}/organization/topics`, icon: Hash, count: topics.length },
          { name: "Skills (Bloom)", href: `${BASE}/organization/skills`, icon: Sparkles },
          { name: "Tags", href: `${BASE}/organization/tags`, icon: Tags },
          { name: "Collections", href: `${BASE}/collections`, icon: Layers },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              to={card.href}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-navy-900" />
                <span className="font-medium text-gray-900 text-sm">{card.name}</span>
                {"count" in card && card.count !== undefined ? (
                  <span className="ml-auto text-xs text-gray-400">{card.count}</span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Browse tree</h3>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400">No categories found.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => {
              const open = openCategory === c.id;
              const catSubjects = subjectsByCat.get(c.id) || [];
              return (
                <li key={c.id} className="border border-gray-100 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenCategory(open ? null : c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-slate-50 hover:bg-slate-100"
                  >
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
                    <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {Number(c.subject_count) || catSubjects.length} subjects · {Number(c.topic_count) || 0} topics
                    </span>
                  </button>
                  {open && (
                    <ul className="px-3 py-2 space-y-2 border-t border-gray-100">
                      {catSubjects.length === 0 ? (
                        <li className="text-xs text-gray-400 py-2">No subjects — create one under Subjects.</li>
                      ) : (
                        catSubjects.map((s) => {
                          const st = topicsBySubject.get(s.id) || [];
                          return (
                            <li key={s.id} className="pl-4">
                              <p className="text-sm font-medium text-gray-800">{s.name}</p>
                              <ul className="mt-1 space-y-1">
                                {st.length === 0 ? (
                                  <li className="text-xs text-gray-400">No topics yet</li>
                                ) : (
                                  st.map((t) => (
                                    <li key={t.id}>
                                      <Link
                                        to={`${BASE}/topics/${t.id}`}
                                        className="text-sm text-admin-accent hover:underline inline-flex items-center gap-2"
                                      >
                                        {t.name}
                                        <span className="text-xs text-gray-400">
                                          {Number(t.question_count) + Number(t.flashcard_count) + Number(t.content_count)} assets
                                        </span>
                                      </Link>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
