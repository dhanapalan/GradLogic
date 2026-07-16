// =============================================================================
// Topic detail — all child assets under one topic (Sprint 3 north star)
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, FileStack, ListChecks, Loader2, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import knowledgeTaxonomyService, { type TopicDetail } from "../../../services/knowledgeTaxonomyService";
import questionBankService, { type Question } from "../../../services/questionBankService";

export default function TopicDetailPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [detail, setDetail] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [candidates, setCandidates] = useState<Question[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    if (!topicId) return;
    setLoading(true);
    knowledgeTaxonomyService
      .getTopic(topicId)
      .then(setDetail)
      .catch(() => toast.error("Failed to load topic"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [topicId]);

  const openAssign = async () => {
    setAssignOpen(true);
    try {
      const res = await questionBankService.searchQuestions({
        search: detail?.topic.name,
        limit: 20,
      });
      setCandidates(res.questions);
    } catch {
      toast.error("Failed to load candidate questions");
    }
  };

  const assign = async (questionId: string) => {
    if (!topicId) return;
    setBusyId(questionId);
    try {
      await knowledgeTaxonomyService.assignAsset({
        asset_type: "question",
        asset_id: questionId,
        topic_id: topicId,
      });
      toast.success("Assigned to topic");
      load();
    } catch {
      toast.error("Assign failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  const { topic, questions, flashcards, content } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/superadmin/knowledge-library/organization/topics" className="text-xs text-admin-accent hover:underline">
          ← Topics
        </Link>
        <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">
          {topic.category_name} → {topic.subject_name}
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 mt-1">{topic.name}</h2>
        {topic.description ? <p className="text-sm text-gray-500 mt-1">{topic.description}</p> : null}
        <p className="text-sm text-gray-500 mt-2">
          Student experience ideal: open this topic and access every related learning asset from one place.
        </p>
      </div>

        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openAssign}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Link2 className="w-4 h-4" /> Link questions to topic
        </button>
        <Link
          to="/app/superadmin/knowledge-library/create"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          Create assets for this topic
        </Link>
        {questions[0] ? (
          <Link
            to={`/app/superadmin/knowledge-library/ai/related?id=${questions[0].id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            Related knowledge
          </Link>
        ) : null}
      </div>

      {assignOpen && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-gray-900">Candidate questions (search by topic name)</p>
            <button type="button" onClick={() => setAssignOpen(false)} className="text-xs text-gray-500">
              Close
            </button>
          </div>
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-400">No candidates found.</p>
          ) : (
            candidates.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-3 border-t border-gray-100 pt-2">
                <p className="text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
                <button
                  type="button"
                  disabled={busyId === q.id}
                  onClick={() => assign(q.id)}
                  className="shrink-0 text-xs font-medium text-admin-accent disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4" /> Questions ({questions.length})
        </h3>
        {questions.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <p className="text-gray-900 line-clamp-2">{q.question_text}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {q.type} · {q.difficulty_level} · {q.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <FileStack className="w-4 h-4" /> Flashcards ({flashcards.length})
        </h3>
        {flashcards.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {flashcards.map((f) => (
              <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="font-medium text-sm text-gray-900">{f.front}</p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{f.back}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4" /> Content ({content.length})
        </h3>
        {content.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {content.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-[11px] uppercase text-gray-400">{c.content_type}</p>
                <p className="font-medium text-sm text-gray-900">{c.title}</p>
                {c.body ? <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.body}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
      Nothing linked yet. Assign assets to this topic to build the learning pack.
    </p>
  );
}
