// =============================================================================
// AI Learning Companion (Phase 15) — "the final Copilot."
//
// A floating assistant mounted once (in StudentPortalLayout) so it's present
// on every student page. Conversation is strictly scoped to whatever
// learning object the current page has registered via
// useLearningCompanion().setCurrentObject() — if nothing is registered, the
// companion honestly shows an idle state instead of guessing a topic.
//
// Voice flow, RAG grounding, and the scope lock all mirror the Voice Tutor
// (Phase 6/7) — this widget reuses that same speech pipeline and SSE
// framing, just with a broader capability set and a floating presentation.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, X, Square, Mic, MicOff, Send, AlertTriangle, Volume2,
  MessageSquareText, HelpCircle, ListOrdered, Lightbulb, BookOpen, Languages,
  RotateCcw, Image, Code2, Globe2, Briefcase,
} from "lucide-react";
import { useLearningCompanion } from "../../contexts/LearningCompanionContext";
import learningCompanion, { type CompanionAction, type CompanionTurn } from "../../services/learningCompanionService";
import voiceTutor, { VOICE_TUTOR_LANGUAGES, type VoiceTutorLanguage } from "../../services/voiceTutorService";

const CAPABILITIES: { key: CompanionAction; label: string; icon: typeof Sparkles }[] = [
  { key: "explain", label: "Explain", icon: MessageSquareText },
  { key: "why", label: "Why", icon: HelpCircle },
  { key: "how", label: "How", icon: ListOrdered },
  { key: "example", label: "Example", icon: BookOpen },
  { key: "hint", label: "Hint", icon: Lightbulb },
  { key: "translate", label: "Translate", icon: Languages },
  { key: "diagram", label: "Diagram", icon: Image },
  { key: "coding_example", label: "Coding Example", icon: Code2 },
  { key: "real_world_example", label: "Real World", icon: Globe2 },
  { key: "placement_tips", label: "Placement Tips", icon: Briefcase },
];

export default function LearningCompanionWidget() {
  const { currentObject, setCurrentObject } = useLearningCompanion();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<VoiceTutorLanguage>("en");
  const [history, setHistory] = useState<CompanionTurn[]>([]);
  const [pendingReply, setPendingReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [postAssessment, setPostAssessment] = useState<{
    drive_name: string | null;
    weak_topics: string[];
    recommended_object_id: string | null;
    recommended_object_label: string | null;
    recommended_lesson_title: string | null;
    recommended_lesson_href: string | null;
    assigned_practice_topic: string | null;
    assigned_practice_href: string | null;
    placement_readiness: number | null;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastCompanionTextRef = useRef<string>("");

  useEffect(() => {
    setHistory([]);
    setPendingReply("");
    setError(null);
    voiceTutor.stopSpeaking();
    voiceTutor.stopListening();
  }, [currentObject?.id]);

  useEffect(() => {
    if (!open || currentObject) return;
    learningCompanion
      .getPostAssessmentContext()
      .then((data) => setPostAssessment(data))
      .catch(() => setPostAssessment(null));
  }, [open, currentObject]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, pendingReply]);

  useEffect(() => {
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

  const run = (action: CompanionAction, text?: string) => {
    if (!currentObject) return;
    interrupt();
    setError(null);
    setBusy(true);
    setPendingReply("");

    const studentTurn: CompanionTurn[] = action === "ask" && text ? [{ role: "student", text }] : [];
    const nextHistory = [...history, ...studentTurn];
    if (studentTurn.length) setHistory(nextHistory);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const splitter = voiceTutor.createSentenceSplitter((sentence) => {
      setIsSpeaking(true);
      voiceTutor.speakChunk(sentence, language, () => setIsSpeaking(false));
    });

    learningCompanion
      .streamConverse(
        { learningObjectId: currentObject.id, action, message: text, language, history: nextHistory },
        {
          onDelta: (chunk) => {
            setPendingReply((prev) => prev + chunk);
            splitter.push(chunk);
          },
          onDone: (result) => {
            splitter.flush();
            lastCompanionTextRef.current = result.text;
            setHistory((prev) => [...prev, { role: "companion", text: result.text }]);
            setPendingReply("");
            setBusy(false);
          },
          onError: (msg) => {
            setError(msg);
            setBusy(false);
            setPendingReply("");
          },
        },
        controller.signal,
      )
      .catch((err) => {
        if (err.name !== "AbortError") setError("The Learning Companion connection dropped. Try again.");
        setBusy(false);
      });
  };

  const repeat = () => {
    if (!lastCompanionTextRef.current) return;
    interrupt();
    const splitter = voiceTutor.createSentenceSplitter((sentence) => {
      setIsSpeaking(true);
      voiceTutor.speakChunk(sentence, language, () => setIsSpeaking(false));
    });
    splitter.push(lastCompanionTextRef.current);
    splitter.flush();
  };

  const handleVoice = () => {
    if (isListening) {
      interrupt();
      return;
    }
    if (!voiceTutor.isSttSupported()) {
      setError("Speech recognition isn't supported in this browser — type instead.");
      return;
    }
    interrupt();
    setIsListening(true);
    voiceTutor.startListening(language, {
      onResult: (text) => run("ask", text),
      onEnd: () => setIsListening(false),
      onError: (msg) => {
        setIsListening(false);
        setError(msg);
      },
    });
  };

  const submitMessage = () => {
    if (!message.trim()) return;
    run("ask", message.trim());
    setMessage("");
  };

  return (
    <div className="fixed right-5 z-50 bottom-5 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {open && (
        <div className="mb-3 w-[22rem] max-h-[32rem] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">Learning Companion</p>
                <p className="text-[11px] text-indigo-100 truncate">{currentObject ? currentObject.label : "No learning object open"}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
          </div>

          {!currentObject ? (
            <div className="p-5 text-center space-y-3">
              <p className="text-sm text-slate-500">
                Open a question or lesson to chat — or continue from your last Assessment Hub
                attempt.
              </p>
              {postAssessment?.recommended_object_id ||
              postAssessment?.recommended_lesson_title ||
              postAssessment?.assigned_practice_href ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-left space-y-2">
                  <p className="text-[11px] font-semibold text-indigo-900">
                    After {postAssessment.drive_name || "your assessment"}
                  </p>
                  {postAssessment.weak_topics?.length ? (
                    <p className="text-[11px] text-indigo-800">
                      Weak topics: {postAssessment.weak_topics.slice(0, 3).join(", ")}
                    </p>
                  ) : null}
                  {postAssessment.placement_readiness != null ? (
                    <p className="text-[11px] text-indigo-700">
                      Placement readiness ~{Math.round(postAssessment.placement_readiness)}%
                    </p>
                  ) : null}
                  {postAssessment.recommended_lesson_title ? (
                    <Link
                      to={
                        postAssessment.recommended_lesson_href ||
                        "/app/student-portal/adaptive-learning"
                      }
                      className="block w-full rounded-lg border border-indigo-200 bg-white text-indigo-800 text-xs font-medium py-2 text-center hover:bg-indigo-50"
                    >
                      Study lesson: {postAssessment.recommended_lesson_title}
                    </Link>
                  ) : null}
                  {postAssessment.assigned_practice_href ? (
                    <Link
                      to={postAssessment.assigned_practice_href}
                      className="block w-full rounded-lg border border-indigo-200 bg-white text-indigo-800 text-xs font-medium py-2 text-center hover:bg-indigo-50"
                    >
                      Start practice
                      {postAssessment.assigned_practice_topic
                        ? ` · ${postAssessment.assigned_practice_topic.replace(/_/g, " ")}`
                        : ""}
                    </Link>
                  ) : null}
                  {postAssessment.recommended_object_id ? (
                    <button
                      type="button"
                      className="w-full rounded-lg bg-indigo-600 text-white text-xs font-medium py-2"
                      onClick={() =>
                        setCurrentObject({
                          id: postAssessment.recommended_object_id!,
                          label:
                            postAssessment.recommended_object_label ||
                            postAssessment.weak_topics?.[0] ||
                            "Post-assessment practice",
                        })
                      }
                    >
                      Chat with Companion on recommended object
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Complete a drive assessment to unlock guided companion follow-up.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                <select
                  value={language}
                  onChange={(e) => { interrupt(); setLanguage(e.target.value as VoiceTutorLanguage); }}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                >
                  {Object.entries(VOICE_TUTOR_LANGUAGES).map(([key, def]) => <option key={key} value={key}>{def.label}</option>)}
                </select>
                <button onClick={repeat} disabled={!lastCompanionTextRef.current} title="Repeat" className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                {(isSpeaking || isListening || busy) && (
                  <button onClick={interrupt} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg px-2 py-1">
                    <Square className="w-3 h-3" /> Stop
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-slate-100">
                {CAPABILITIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => run(c.key)}
                    disabled={busy}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200 text-[11px] font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40"
                  >
                    <c.icon className="w-3 h-3" /> {c.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[8rem]">
                {history.map((turn, i) => (
                  <div key={i} className={turn.role === "student" ? "text-right" : "text-left"}>
                    <span className={`inline-block max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${turn.role === "student" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                      {turn.text}
                    </span>
                  </div>
                ))}
                {pendingReply && (
                  <div className="text-left">
                    <span className="inline-block max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-800">
                      {pendingReply}<span className="inline-block w-1 h-3 bg-slate-400 ml-0.5 animate-pulse" />
                    </span>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              <div className="flex gap-1.5 p-2.5 border-t border-slate-100">
                <button
                  onClick={handleVoice}
                  className={`p-2 rounded-lg border ${isListening ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 text-slate-500 hover:border-indigo-400 hover:text-indigo-600"}`}
                  title="Voice"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitMessage()}
                  placeholder="Ask about this…"
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5"
                />
                <button onClick={submitMessage} disabled={!message.trim() || busy} className="p-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-colors relative"
        title="AI Learning Companion"
      >
        {isSpeaking && <Volume2 className="w-3.5 h-3.5 absolute -top-1 -right-1 bg-white text-indigo-600 rounded-full p-0.5" />}
        <Sparkles className="w-6 h-6" />
      </button>
    </div>
  );
}
