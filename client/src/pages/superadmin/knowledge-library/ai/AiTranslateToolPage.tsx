import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import translatorService from "../../../../services/translatorService";
import aiKnowledgeService from "../../../../services/aiKnowledgeService";
import questionBankService from "../../../../services/questionBankService";
import type { VoiceTutorLanguage } from "../../../../services/voiceTutorService";

const LANGS: { code: VoiceTutorLanguage; label: string }[] = [
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" },
  { code: "ml", label: "Malayalam" },
  { code: "te", label: "Telugu" },
  { code: "en", label: "English" },
];

export default function AiTranslateToolPage() {
  const [questionId, setQuestionId] = useState("");
  const [language, setLanguage] = useState<VoiceTutorLanguage>("ta");
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [koResult, setKoResult] = useState<Record<string, unknown> | null>(null);
  const [freeResult, setFreeResult] = useState("");

  const translateKo = async () => {
    if (!questionId.trim()) {
      toast.error("Question ID required");
      return;
    }
    setLoading(true);
    setKoResult(null);
    try {
      // Ensure question exists before calling translator
      await questionBankService.getQuestion(questionId.trim());
      const data = await translatorService.translate(questionId.trim(), language);
      setKoResult(data as unknown as Record<string, unknown>);
    } catch {
      toast.error("Translation failed — check ID and engine");
    } finally {
      setLoading(false);
    }
  };

  const translateFree = async () => {
    if (!freeText.trim()) {
      toast.error("Enter text");
      return;
    }
    setLoading(true);
    try {
      const langLabel = LANGS.find((l) => l.code === language)?.label || language;
      const res = await aiKnowledgeService.translate(freeText, langLabel);
      setFreeResult(res.translated);
    } catch {
      toast.error("Free-form translate failed");
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
        <h2 className="mt-2 text-lg font-semibold text-gray-900">AI Translation</h2>
        <p className="text-sm text-gray-500">Translate a knowledge object or free-form content.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as VoiceTutorLanguage)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900">Knowledge object</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value)}
            placeholder="Question UUID"
            className="flex-1 min-w-[14rem] rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={loading}
            onClick={translateKo}
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Translate KO
          </button>
        </div>
        {koResult ? (
          <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-auto max-h-64">
            {JSON.stringify(koResult, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900">Free-form</h3>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Paste lesson, explanation, or flashcard text…"
        />
        <button
          type="button"
          disabled={loading}
          onClick={translateFree}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50"
        >
          Translate text
        </button>
        {freeResult ? <p className="text-sm text-gray-800 whitespace-pre-wrap border-t border-gray-100 pt-3">{freeResult}</p> : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : null}
    </div>
  );
}
