// =============================================================================
// AI Content Improver (Phase 13) — one question, six improvement types.
//
// Improve NEVER touches the live question — it always creates a new proposed
// version. Apply/Reject are separate, explicit actions.
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Wand2, SpellCheck, ListChecks, MessageSquareText, Lightbulb, Gauge, Code2,
  Loader2, CheckCircle2, XCircle, ArrowLeft, History,
} from "lucide-react";
import toast from "react-hot-toast";
import contentImprover, { type ImprovementType, type QuestionVersion } from "../../../services/contentImproverService";
import questionBankService, { type Question } from "../../../services/questionBankService";

const IMPROVEMENTS: { key: ImprovementType; label: string; icon: typeof Wand2 }[] = [
  { key: "grammar", label: "Grammar", icon: SpellCheck },
  { key: "distractors", label: "Distractors", icon: ListChecks },
  { key: "explanation", label: "Explanation", icon: MessageSquareText },
  { key: "examples", label: "Examples / Hint", icon: Lightbulb },
  { key: "difficulty", label: "Difficulty", icon: Gauge },
  { key: "coding_version", label: "Coding version", icon: Code2 },
];

export default function ImproveQuestionPage() {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question | null>(null);
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [busy, setBusy] = useState<ImprovementType | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = () => {
    if (!questionId) return;
    questionBankService.getQuestion(questionId).then(setQuestion).catch(() => toast.error("Couldn't load question"));
    contentImprover.getVersions(questionId).then(setVersions).catch(() => {});
  };

  useEffect(load, [questionId]);

  const runImprove = async (type: ImprovementType) => {
    if (!questionId) return;
    setBusy(type);
    try {
      await contentImprover.improve(questionId, type);
      toast.success("Proposed a new version — review it below");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Improvement failed");
    } finally {
      setBusy(null);
    }
  };

  const apply = async (versionId: string) => {
    setActingOn(versionId);
    try {
      await contentImprover.applyVersion(versionId);
      toast.success("Applied — the live question was updated");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Apply failed");
    } finally {
      setActingOn(null);
    }
  };

  const reject = async (versionId: string) => {
    setActingOn(versionId);
    try {
      await contentImprover.rejectVersion(versionId);
      load();
    } finally {
      setActingOn(null);
    }
  };

  if (!question) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-navy-900/[0.06] rounded-lg"><Wand2 className="w-4 h-4 text-navy-900" /></div>
          <h1 className="text-lg font-semibold text-gray-900">AI Content Improver</h1>
        </div>
        <p className="text-sm text-gray-800">{question.question_text}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {IMPROVEMENTS.map((imp) => (
          <button
            key={imp.key}
            onClick={() => runImprove(imp.key)}
            disabled={busy !== null}
            className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-gray-200 bg-white hover:border-admin-accent hover:bg-navy-900/[0.02] disabled:opacity-50"
          >
            {busy === imp.key ? <Loader2 className="w-4 h-4 animate-spin text-admin-accent" /> : <imp.icon className="w-4 h-4 text-admin-accent" />}
            <span className="text-xs font-medium text-gray-700">{imp.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-navy-900" /> Version history
        </h2>
        {versions.length === 0 ? (
          <p className="text-sm text-gray-400">No proposed versions yet — run an improvement above.</p>
        ) : (
          <div className="space-y-3">
            {versions.map((v) => (
              <div key={v.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-navy-900/[0.06] text-navy-900 capitalize">
                    {v.improvement_type.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      v.status === "applied" ? "bg-green-50 text-green-700" : v.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {v.status}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.change_summary && <p className="text-xs text-gray-600 mb-2">{v.change_summary}</p>}
                {v.question_text && <p className="text-sm text-gray-800 mb-1"><span className="text-gray-400">Question: </span>{v.question_text}</p>}
                {v.explanation && <p className="text-sm text-gray-700 mb-1"><span className="text-gray-400">Explanation: </span>{v.explanation}</p>}
                {v.hint && <p className="text-sm text-gray-700 mb-1"><span className="text-gray-400">Hint: </span>{v.hint}</p>}
                {v.options && (
                  <ul className="text-sm text-gray-700 list-disc list-inside mb-1">
                    {v.options.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                )}
                {v.status === "proposed" && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => apply(v.id)}
                      disabled={actingOn !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Apply
                    </button>
                    <button
                      onClick={() => reject(v.id)}
                      disabled={actingOn !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
