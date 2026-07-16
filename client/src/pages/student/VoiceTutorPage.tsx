// =============================================================================
// AI Voice Tutor (Phase 6) — the flagship feature.
//
// A student opens this page for exactly one knowledge object (question) and
// talks to a scoped AI tutor about it: Listen / Explain / Hint / Example /
// Translate / Ask AI. Voice flow: browser Speech-to-Text → server LLM
// (streamed) → browser Text-to-Speech, spoken sentence-by-sentence as the
// reply streams in. Any button press or fresh mic press interrupts
// in-progress playback (barge-in).
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Volume2, MessageSquareText, Lightbulb, Sparkles, Languages, Mic, MicOff,
  Square, ArrowLeft, Loader2, AlertTriangle, Send, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import voiceTutor, {
  VOICE_TUTOR_LANGUAGES,
  type VoiceTutorLanguage,
  type VoiceTutorAction,
  type ConversationTurn,
  type KnowledgeObjectView,
} from "../../services/voiceTutorService";
import translator, { type TranslatedKnowledgeObject } from "../../services/translatorService";
import { useLearningCompanion } from "../../contexts/LearningCompanionContext";

interface ActionDef {
  key: VoiceTutorAction;
  label: string;
  icon: typeof Volume2;
}

const ACTIONS: ActionDef[] = [
  { key: "listen", label: "Listen", icon: Volume2 },
  { key: "explain", label: "Explain", icon: MessageSquareText },
  { key: "hint", label: "Hint", icon: Lightbulb },
  { key: "example", label: "Example", icon: Sparkles },
  { key: "translate", label: "Translate", icon: Languages },
];

export default function VoiceTutorPage() {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();

  const [ko, setKo] = useState<KnowledgeObjectView | null>(null);
  const [loadingKo, setLoadingKo] = useState(true);
  const [language, setLanguage] = useState<VoiceTutorLanguage>("en");
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [pendingReply, setPendingReply] = useState("");
  const [busyAction, setBusyAction] = useState<VoiceTutorAction | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [askText, setAskText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState<TranslatedKnowledgeObject | null>(null);
  const [translating, setTranslating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { setCurrentObject } = useLearningCompanion();

  useEffect(() => {
    if (!questionId) return;
    voiceTutor
      .fetchKnowledgeObject(questionId)
      .then((data) => {
        setKo(data);
        setCurrentObject({ id: data.id, label: data.question_text.slice(0, 60) });
      })
      .catch(() => toast.error("Couldn't load this question"))
      .finally(() => setLoadingKo(false));
  }, [questionId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, pendingReply]);

  useEffect(() => {
    // Leaving the page mid-conversation shouldn't leave audio playing or a
    // stream running in the background.
    return () => {
      voiceTutor.stopSpeaking();
      voiceTutor.stopListening();
      abortRef.current?.abort();
    };
  }, []);

  const interrupt = () => {
    voiceTutor.stopSpeaking();
    voiceTutor.stopListening();
    setIsSpeaking(false);
    setIsListening(false);
  };

  const runAction = (action: VoiceTutorAction, message?: string) => {
    if (!questionId) return;
    interrupt(); // barge-in: a new request always cancels whatever's playing
    setError(null);
    setBusyAction(action);
    setPendingReply("");

    const studentTurn: ConversationTurn[] =
      action === "ask" && message ? [{ role: "student", text: message }] : [];
    const historyForRequest = [...history, ...studentTurn];
    if (studentTurn.length) setHistory(historyForRequest);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const splitter = voiceTutor.createSentenceSplitter((sentence) => {
      setIsSpeaking(true);
      voiceTutor.speakChunk(sentence, language, () => setIsSpeaking(false));
    });

    voiceTutor
      .streamConverse(
        { questionId, action, message, language, history: historyForRequest },
        {
          onDelta: (chunk) => {
            setPendingReply((prev) => prev + chunk);
            splitter.push(chunk);
          },
          onDone: (result) => {
            splitter.flush();
            setHistory((prev) => [...prev, { role: "tutor", text: result.text }]);
            setPendingReply("");
            setBusyAction(null);
          },
          onError: (message) => {
            setError(message);
            setBusyAction(null);
            setPendingReply("");
          },
        },
        controller.signal,
      )
      .catch((err) => {
        if (err.name !== "AbortError") setError("The Voice Tutor connection dropped. Try again.");
        setBusyAction(null);
      });
  };

  const handleMic = () => {
    if (isListening) {
      interrupt();
      return;
    }
    if (!voiceTutor.isSttSupported()) {
      toast.error("Speech recognition isn't supported in this browser — type your question below instead.");
      return;
    }
    interrupt();
    setIsListening(true);
    voiceTutor.startListening(language, {
      onResult: (text) => {
        setAskText(text);
        runAction("ask", text);
      },
      onEnd: () => setIsListening(false),
      onError: (message) => {
        setIsListening(false);
        toast.error(message);
      },
    });
  };

  const submitAsk = () => {
    if (!askText.trim()) return;
    runAction("ask", askText.trim());
    setAskText("");
  };

  const showTranslatedText = () => {
    if (!questionId) return;
    setTranslating(true);
    translator
      .translate(questionId, language)
      .then(setTranslated)
      .catch(() => toast.error("Couldn't translate this text right now"))
      .finally(() => setTranslating(false));
  };

  if (loadingKo) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!ko) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-slate-500">This question couldn't be found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 text-sm font-medium">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Knowledge object */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">
            {ko.category.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-slate-400 capitalize">{ko.difficulty_level}</span>
        </div>
        <p className="text-slate-800 font-medium leading-relaxed mb-3">{ko.question_text}</p>
        {ko.options && ko.options.length > 0 && (
          <ul className="space-y-1.5 text-sm text-slate-600">
            {ko.options.map((opt, i) => (
              <li key={i}>
                <span className="font-semibold text-slate-400 mr-1.5">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Language + interrupt */}
      <div className="flex items-center justify-between gap-3">
        <select
          value={language}
          onChange={(e) => {
            interrupt();
            setLanguage(e.target.value as VoiceTutorLanguage);
            setTranslated(null);
          }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          {Object.entries(VOICE_TUTOR_LANGUAGES).map(([key, def]) => (
            <option key={key} value={key}>{def.label}</option>
          ))}
        </select>
        {(isSpeaking || isListening || busyAction) && (
          <button
            onClick={interrupt}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2 hover:bg-red-100"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => runAction(a.key)}
            disabled={busyAction !== null}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 disabled:opacity-40 transition-colors"
          >
            {busyAction === a.key ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            ) : (
              <a.icon className="w-4 h-4 text-indigo-500" />
            )}
            <span className="text-xs font-medium text-slate-700">{a.label}</span>
          </button>
        ))}
        <button
          onClick={handleMic}
          disabled={busyAction !== null && busyAction !== "ask"}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
            isListening
              ? "border-red-400 bg-red-50 text-red-600"
              : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50"
          } disabled:opacity-40`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-indigo-500" />}
          <span className="text-xs font-medium text-slate-700">{isListening ? "Listening…" : "Ask AI"}</span>
        </button>
      </div>

      {/* Type-to-ask fallback (also used by mic result before it's sent) */}
      <div className="flex gap-2">
        <input
          value={askText}
          onChange={(e) => setAskText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAsk()}
          placeholder="Or type a question about this…"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
        <button
          onClick={submitAsk}
          disabled={!askText.trim() || busyAction !== null}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Full-text translation (Phase 14) — question + explanation + hint + examples, keeping technical terms intact */}
      {language !== "en" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          {!translated ? (
            <button
              onClick={showTranslatedText}
              disabled={translating}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 py-2 disabled:opacity-50"
            >
              {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Show translated text ({VOICE_TUTOR_LANGUAGES[language].label})
            </button>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-xs font-medium text-indigo-500 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Translated ({VOICE_TUTOR_LANGUAGES[language].label})</p>
              <p className="text-slate-800">{translated.question}</p>
              {translated.options && translated.options.length > 0 && (
                <ul className="space-y-1 text-slate-600">
                  {translated.options.map((opt, i) => (
                    <li key={i}><span className="font-semibold text-slate-400 mr-1.5">{String.fromCharCode(65 + i)}.</span>{opt}</li>
                  ))}
                </ul>
              )}
              {translated.hint && <p className="text-slate-600"><span className="text-slate-400">Hint: </span>{translated.hint}</p>}
              {translated.explanation && <p className="text-slate-600"><span className="text-slate-400">Explanation: </span>{translated.explanation}</p>}
              {translated.examples && translated.examples.length > 0 && (
                <div className="text-slate-600">
                  <span className="text-slate-400">Examples: </span>
                  <ul className="list-disc list-inside">
                    {translated.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Transcript */}
      {(history.length > 0 || pendingReply) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 max-h-80 overflow-y-auto">
          {history.map((turn, i) => (
            <div key={i} className={turn.role === "student" ? "text-right" : "text-left"}>
              <span
                className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  turn.role === "student" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {turn.text}
              </span>
            </div>
          ))}
          {pendingReply && (
            <div className="text-left">
              <span className="inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm bg-slate-100 text-slate-800">
                {pendingReply}
                <span className="inline-block w-1.5 h-3.5 bg-slate-400 ml-0.5 animate-pulse" />
              </span>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        This tutor only discusses the question above — it won't reveal the correct answer, and it won't
        go off-topic.
      </p>
    </div>
  );
}
