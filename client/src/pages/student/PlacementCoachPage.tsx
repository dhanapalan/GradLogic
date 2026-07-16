// =============================================================================
// AI Placement Coach (Phase 9)
//
// Input: student (JWT) + skills/resume/assessment signals (server-computed) +
// target company/role (free text, entered here). Output: Placement Readiness,
// Weak Skills, Interview Questions, Coding Challenges, Study Plan, and a
// Voice Coaching conversation reusing the exact STT/TTS pipeline from the
// Voice Tutor (Phase 6/7).
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, Gauge, TrendingDown, MessageSquareText, Code2, Map, Mic, MicOff,
  Square, Loader2, Send, AlertTriangle, FileWarning,
} from "lucide-react";
import placementCoach, {
  type PlacementCoachReport,
  type CoachConversationTurn,
} from "../../services/placementCoachService";
import voiceTutor, { type VoiceTutorLanguage } from "../../services/voiceTutorService";

const READINESS_COLOR: Record<string, string> = {
  "Getting started": "text-red-600 bg-red-50",
  "Building readiness": "text-amber-600 bg-amber-50",
  "Interview ready": "text-green-600 bg-green-50",
  "Highly prepared": "text-indigo-600 bg-indigo-50",
};

const TYPE_COLOR: Record<string, string> = {
  behavioral: "bg-blue-50 text-blue-700",
  technical: "bg-purple-50 text-purple-700",
  company_specific: "bg-amber-50 text-amber-700",
};

export default function PlacementCoachPage() {
  const navigate = useNavigate();
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [submittedCompany, setSubmittedCompany] = useState<string | undefined>();
  const [submittedRole, setSubmittedRole] = useState<string | undefined>();
  const [report, setReport] = useState<PlacementCoachReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [history, setHistory] = useState<CoachConversationTurn[]>([]);
  const [pendingReply, setPendingReply] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState("");
  const [coachError, setCoachError] = useState<string | null>(null);

  const language: VoiceTutorLanguage = "en";
  const abortRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const loadReport = (company?: string, role?: string) => {
    setLoading(true);
    setLoadError(null);
    placementCoach
      .getReport(company, role)
      .then(setReport)
      .catch(() => setLoadError("Couldn't load your placement report — try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const runGenerate = () => {
    setSubmittedCompany(targetCompany.trim() || undefined);
    setSubmittedRole(targetRole.trim() || undefined);
    loadReport(targetCompany.trim() || undefined, targetRole.trim() || undefined);
  };

  const interrupt = () => {
    voiceTutor.stopSpeaking();
    voiceTutor.stopListening();
    setIsSpeaking(false);
    setIsListening(false);
  };

  const sendToCoach = (text: string) => {
    if (!text.trim()) return;
    interrupt();
    setCoachError(null);
    setCoachBusy(true);
    setPendingReply("");

    const nextHistory: CoachConversationTurn[] = [...history, { role: "student", text }];
    setHistory(nextHistory);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const splitter = voiceTutor.createSentenceSplitter((sentence) => {
      setIsSpeaking(true);
      voiceTutor.speakChunk(sentence, language, () => setIsSpeaking(false));
    });

    placementCoach
      .streamConverse(
        { message: text, targetCompany: submittedCompany, targetRole: submittedRole, history: nextHistory },
        {
          onDelta: (chunk) => {
            setPendingReply((prev) => prev + chunk);
            splitter.push(chunk);
          },
          onDone: (result) => {
            splitter.flush();
            setHistory((prev) => [...prev, { role: "coach", text: result.text }]);
            setPendingReply("");
            setCoachBusy(false);
          },
          onError: (msg) => {
            setCoachError(msg);
            setCoachBusy(false);
            setPendingReply("");
          },
        },
        controller.signal,
      )
      .catch((err) => {
        if (err.name !== "AbortError") setCoachError("The coaching connection dropped. Try again.");
        setCoachBusy(false);
      });
  };

  const handleMic = () => {
    if (isListening) {
      interrupt();
      return;
    }
    if (!voiceTutor.isSttSupported()) {
      setCoachError("Speech recognition isn't supported in this browser — type instead.");
      return;
    }
    interrupt();
    setIsListening(true);
    voiceTutor.startListening(language, {
      onResult: (text) => sendToCoach(text),
      onEnd: () => setIsListening(false),
      onError: (msg) => {
        setIsListening(false);
        setCoachError(msg);
      },
    });
  };

  const submitMessage = () => {
    if (!message.trim()) return;
    sendToCoach(message.trim());
    setMessage("");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Briefcase className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Coach</h1>
          <p className="text-sm text-slate-500">Your readiness, weak spots, and a plan — tailored to a target role/company.</p>
        </div>
      </div>

      {/* Target company/role input */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row gap-3">
        <input
          value={targetCompany}
          onChange={(e) => setTargetCompany(e.target.value)}
          placeholder="Target company (optional, e.g. TCS)"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
        <input
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="Target role (optional, e.g. SDE Intern)"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
        <button
          onClick={runGenerate}
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Generating…" : "Generate Coaching"}
        </button>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {loadError}
        </div>
      )}

      {loading && !report && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      )}

      {report && (
        <>
          {/* Readiness */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-500" /> Placement readiness
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-3xl font-bold text-slate-900">{report.readiness.score}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${READINESS_COLOR[report.readiness.label]}`}>
                {report.readiness.label}
              </span>
              {report.readiness.dataQuality === "low" && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <FileWarning className="w-3.5 h-3.5" /> Based on limited data so far
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
              <div>
                <p className="text-slate-400">Practice accuracy</p>
                <p className="font-semibold text-slate-700">{report.readiness.breakdown.practiceAccuracyScore}</p>
              </div>
              <div>
                <p className="text-slate-400">Exam average</p>
                <p className="font-semibold text-slate-700">{report.readiness.breakdown.examScore}</p>
              </div>
              <div>
                <p className="text-slate-400">Profile complete</p>
                <p className="font-semibold text-slate-700">{report.readiness.breakdown.profileCompletenessScore}</p>
              </div>
            </div>
            {!report.hasResume && (
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Upload a resume on your profile to improve this score.
              </p>
            )}
          </div>

          {/* Weak skills */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-indigo-500" /> Weak skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {report.weakSkills.map((s) => (
                <span key={s.category} className="px-3 py-1.5 bg-slate-50 rounded-full text-xs text-slate-600 capitalize">
                  {s.category.replace(/_/g, " ")} {s.hasEnoughData ? `· ${Math.round(s.accuracy * 100)}%` : "· no data"}
                </span>
              ))}
            </div>
          </div>

          {/* Interview questions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-indigo-500" /> Interview questions
            </h2>
            <div className="space-y-2">
              {report.interviewQuestions.length === 0 && (
                <p className="text-sm text-slate-400">Couldn't generate questions right now — try again shortly.</p>
              )}
              {report.interviewQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${TYPE_COLOR[q.type]}`}>
                    {q.type.replace(/_/g, " ")}
                  </span>
                  <p className="text-sm text-slate-700">{q.question}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coding challenges */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-500" /> Coding challenges
            </h2>
            {report.codingChallenges.length === 0 ? (
              <p className="text-sm text-slate-400">No matching coding challenges yet for your weak areas.</p>
            ) : (
              <div className="space-y-2">
                {report.codingChallenges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-700 line-clamp-1 flex-1">{c.question_text}</p>
                    <span className="text-xs text-slate-400 capitalize ml-3 shrink-0">{c.difficulty_level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Study plan */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Map className="w-4 h-4 text-indigo-500" /> Study plan
              </h2>
              <span className="text-xs text-slate-400">~{report.studyPlan.totalEstimatedMinutes} min total</span>
            </div>
            <div className="space-y-3">
              {report.studyPlan.steps.map((step) => (
                <div key={step.order} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">
                    {step.order}
                  </div>
                  <span className="text-sm text-slate-700 capitalize flex-1">{step.category.replace(/_/g, " ")}</span>
                  <span className="text-xs text-slate-400">~{step.estimatedMinutes} min</span>
                  <button
                    onClick={() => navigate(`/app/student-portal/practice?topic=${step.category}&difficulty=${step.difficulty}`)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Practice
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Voice coaching */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-500" /> Voice coaching
              </h2>
              {(isSpeaking || isListening || coachBusy) && (
                <button
                  onClick={interrupt}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-1.5 hover:bg-red-100"
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={handleMic}
                disabled={coachBusy && !isListening}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isListening ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50"
                } disabled:opacity-40`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-indigo-500" />}
                {isListening ? "Listening…" : "Talk to your coach"}
              </button>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitMessage()}
                placeholder="Or type here…"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
              />
              <button
                onClick={submitMessage}
                disabled={!message.trim() || coachBusy}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {coachError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {coachError}
              </div>
            )}

            {(history.length > 0 || pendingReply) && (
              <div className="space-y-3 max-h-72 overflow-y-auto">
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
          </div>
        </>
      )}
    </div>
  );
}
