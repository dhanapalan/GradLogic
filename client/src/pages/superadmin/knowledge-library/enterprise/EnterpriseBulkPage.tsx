import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService, { type Question } from "../../../../services/questionBankService";
import knowledgeTaxonomyService, { type TaxonomyTopic } from "../../../../services/knowledgeTaxonomyService";
import knowledgeLibraryEnterpriseService from "../../../../services/knowledgeLibraryEnterpriseService";

export default function EnterpriseBulkPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      questionBankService.searchQuestions({ search: search || undefined, page: 1, limit: 50 }),
      knowledgeTaxonomyService.listTopics(),
    ])
      .then(([q, t]) => {
        setQuestions(q.questions);
        setTopics(t);
        if (!topicId && t[0]) setTopicId(t[0].id);
      })
      .catch(() => toast.error("Failed to load questions"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(questions.map((q) => q.id)));
  const clear = () => setSelected(new Set());

  const bulk = async (action: "publish" | "archive") => {
    if (selected.size === 0) {
      toast.error("Select questions");
      return;
    }
    setBusy(true);
    try {
      await questionBankService.bulkAction(action, [...selected]);
      toast.success(`${action}d ${selected.size}`);
      clear();
      load();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setBusy(false);
    }
  };

  const assignTopic = async () => {
    if (selected.size === 0 || !topicId) {
      toast.error("Select questions and a topic");
      return;
    }
    setBusy(true);
    try {
      const res = await knowledgeLibraryEnterpriseService.bulkAssignTopic({
        asset_type: "question",
        asset_ids: [...selected],
        topic_id: topicId,
      });
      toast.success(`Assigned topic to ${res.updated}`);
      clear();
    } catch {
      toast.error("Topic assign failed");
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
        <h2 className="mt-2 text-lg font-semibold text-gray-900">Bulk Operations</h2>
        <p className="text-sm text-gray-500">Publish, archive, or assign a taxonomy topic across selected questions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter questions…"
          className="flex-1 min-w-[12rem] rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={load} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          Search
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center rounded-xl border border-gray-200 bg-white p-3">
        <span className="text-xs text-gray-500 mr-2">{selected.size} selected</span>
        <button type="button" onClick={selectAll} className="text-xs text-admin-accent">
          Select page
        </button>
        <button type="button" onClick={clear} className="text-xs text-gray-500">
          Clear
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => bulk("publish")}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => bulk("archive")}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Archive
        </button>
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs max-w-[14rem]"
        >
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.category_name} / {t.subject_name} / {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !topics.length}
          onClick={assignTopic}
          className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Assign topic
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <label key={q.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
              <div>
                <p className="text-sm text-gray-900 line-clamp-2">{q.question_text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {q.category} · {q.status} · {q.difficulty_level}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
