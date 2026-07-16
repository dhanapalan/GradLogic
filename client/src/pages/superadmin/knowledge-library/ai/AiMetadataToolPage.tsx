import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import aiKnowledgeService from "../../../../services/aiKnowledgeService";
import questionBankService from "../../../../services/questionBankService";

export default function AiMetadataToolPage() {
  const [questionId, setQuestionId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary?: string;
    difficulty?: string;
    bloom?: string;
    skills?: string[];
    confidence?: { difficulty?: number; bloom?: number };
  } | null>(null);

  const loadQuestion = async () => {
    if (!questionId.trim()) return;
    try {
      const q = await questionBankService.getQuestion(questionId.trim());
      setText(q.question_text);
      toast.success("Loaded question text");
    } catch {
      toast.error("Question not found");
    }
  };

  const run = async () => {
    if (!text.trim()) {
      toast.error("Paste content or load a question");
      return;
    }
    setLoading(true);
    try {
      const [summary, difficulty, bloom, skills] = await Promise.all([
        aiKnowledgeService.summarize(text, 80),
        aiKnowledgeService.predictDifficulty(text),
        aiKnowledgeService.classifyBloom(text),
        aiKnowledgeService.extractSkills(text),
      ]);
      setResult({
        summary: summary.summary,
        difficulty: difficulty.difficulty,
        bloom: bloom.bloomLevel,
        skills: skills.skills,
        confidence: { difficulty: difficulty.confidence, bloom: bloom.confidence },
      });
    } catch {
      toast.error("Metadata generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/superadmin/knowledge-library/ai" className="text-xs text-admin-accent hover:underline">
          ← AI Features
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">AI Metadata & Summary</h2>
        <p className="text-sm text-gray-500">
          Propose summary, difficulty, Bloom level, and skills. Review before applying to assets.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          placeholder="Question UUID (optional)"
          className="flex-1 min-w-[14rem] rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={loadQuestion} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          Load
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Knowledge content…"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />

      <button
        type="button"
        disabled={loading}
        onClick={run}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Generate metadata
      </button>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : result ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3 shadow-admin-card">
          <Field label="Summary" value={result.summary} />
          <Field
            label="Difficulty"
            value={`${result.difficulty}${result.confidence?.difficulty != null ? ` (${Math.round(result.confidence.difficulty * 100)}%)` : ""}`}
          />
          <Field
            label="Bloom"
            value={`${result.bloom}${result.confidence?.bloom != null ? ` (${Math.round(result.confidence.bloom * 100)}%)` : ""}`}
          />
          <div>
            <p className="text-xs uppercase text-gray-400 mb-1">Skills</p>
            <div className="flex flex-wrap gap-1">
              {(result.skills || []).map((s) => (
                <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                  {s}
                </span>
              ))}
            </div>
          </div>
          {questionId ? (
            <Link
              to={`/app/superadmin/learning-companion/improve/${questionId}`}
              className="inline-block text-sm text-admin-accent hover:underline"
            >
              Open improver to apply changes →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-900 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}
