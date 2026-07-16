// =============================================================================
// Translation Studio — translate a knowledge object into supported languages.
// =============================================================================

import { useEffect, useState } from "react";
import { Languages, Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService, { type Question } from "../../../services/questionBankService";
import translatorService from "../../../services/translatorService";
import { VOICE_TUTOR_LANGUAGES, type VoiceTutorLanguage } from "../../../services/voiceTutorService";
import { EmptyState, PageHeader } from "./FeatureUi";

export default function TranslationStudioPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Question | null>(null);
  const [language, setLanguage] = useState<VoiceTutorLanguage>("hi");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    question: string;
    options?: string[];
    explanation?: string;
    hint?: string;
  } | null>(null);

  const load = () => {
    setLoading(true);
    questionBankService
      .searchQuestions({ search: query || undefined, limit: 20, page: 1 })
      .then((res) => setRows(res.questions))
      .catch(() => toast.error("Failed to load questions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translate = async () => {
    if (!selected) return toast.error("Pick a question first");
    setBusy(true);
    setResult(null);
    try {
      const data = await translatorService.translate(selected.id, language);
      setResult(data);
      toast.success("Translated");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Translation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Languages}
        title="Translation Studio"
        description="Translate question knowledge objects into supported student languages."
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Search questions…"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <button type="button" onClick={load} className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white">
              Search
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState message="No questions found." />
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {rows.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setSelected(q);
                    setResult(null);
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    selected?.id === q.id ? "bg-navy-900/10 text-navy-900" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="line-clamp-2">{q.question_text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-sm text-gray-600">
            Target language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as VoiceTutorLanguage)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {Object.entries(VOICE_TUTOR_LANGUAGES).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={busy || !selected}
            onClick={translate}
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Translating…" : "Translate"}
          </button>

          {selected && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-gray-700">
              <p className="text-xs uppercase text-gray-400 mb-1">Source</p>
              <p className="whitespace-pre-wrap">{selected.question_text}</p>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-gray-800 space-y-2">
              <p className="text-xs uppercase text-emerald-700">Translated</p>
              <p className="font-medium whitespace-pre-wrap">{result.question}</p>
              {result.options?.length ? (
                <ul className="list-disc pl-5 space-y-0.5">
                  {result.options.map((opt, i) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              ) : null}
              {result.explanation ? <p className="text-gray-600">{result.explanation}</p> : null}
              {result.hint ? <p className="text-gray-500 text-xs">Hint: {result.hint}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
