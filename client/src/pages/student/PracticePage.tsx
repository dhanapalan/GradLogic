// =============================================================================
// Student Practice Arena
// Quiz Mode · Coding Problems · Stats
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useLearningCompanion } from "../../contexts/LearningCompanionContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../../lib/api";
import {
  Code2,
  Brain,
  BarChart3,
  Play,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Clock,
  Trophy,
  Target,
  BookOpen,
  Filter,
  RefreshCw,
  Terminal,
  Send,
  Headphones,
  Lightbulb,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  Infinity,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import studentPracticeService, {
  practiceTopicLabel,
  type PracticeBookmark,
} from "../../services/studentPracticeService";
import { phase1DomainByValue } from "../../lib/phase1PlacementDomains";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Topic {
  topic: string;
  total_questions: number;
  easy: number;
  medium: number;
  hard: number;
}

interface Question {
  id: string;
  category: string;
  type: string;
  difficulty_level: string;
  question_text: string;
  options: string[] | null;
  marks: number;
  hint?: string | null;
}

interface CodingProblem {
  id: string;
  category: string;
  difficulty_level: string;
  title: string;
  marks: number;
  tags: string[] | null;
  starter_code: string | Record<string, string> | null;
  sample_tests?: Array<{ input: string; expectedOutput: string }>;
  hidden_test_count?: number;
  has_hint?: boolean;
  has_explanation?: boolean;
  question_text?: string;
}

function pickStarter(
  starter: string | Record<string, string> | null | undefined,
  language: string
): string {
  if (!starter) return "";
  if (typeof starter === "string") return starter;
  return starter[language] || starter.python || starter.java || Object.values(starter)[0] || "";
}

interface PracticeStats {
  sessions: {
    total_sessions: number;
    completed_sessions: number;
    avg_score: number;
    total_time_seconds: number;
  };
  coding: {
    total_submissions: number;
    accepted: number;
    unique_problems_solved: number;
  };
  topics: { topic: string; sessions: number; avg_score: number }[];
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────

function DiffBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    easy: "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    hard: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
        map[level?.toLowerCase()] || "bg-slate-100 text-slate-600"
      }`}
    >
      {level}
    </span>
  );
}

// ─── StatsPanel ──────────────────────────────────────────────────────────────

function StatsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["practice-stats"],
    queryFn: async () => {
      const { data } = await api.get("/practice/stats");
      return data.data as PracticeStats;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const { sessions, coding, topics } = data;
  const totalTime = sessions.total_time_seconds || 0;
  const hours = Math.floor(totalTime / 3600);
  const minutes = Math.floor((totalTime % 3600) / 60);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Sessions Done",
            value: sessions.completed_sessions,
            icon: CheckCircle2,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Avg Quiz Score",
            value: `${sessions.avg_score || 0}%`,
            icon: Target,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "Problems Solved",
            value: coding.unique_problems_solved,
            icon: Code2,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Practice Time",
            value: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
          >
            <div className={`h-9 w-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Coding acceptance */}
      {coding.total_submissions > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Code2 className="h-4 w-4 text-purple-600" />
            Coding Submissions
          </h3>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-slate-900">{coding.accepted}</p>
              <p className="text-xs text-slate-500">Accepted</p>
            </div>
            <div className="flex-1 h-2 bg-slate-100 rounded-full">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{
                  width: `${Math.round((coding.accepted / coding.total_submissions) * 100)}%`,
                }}
              />
            </div>
            <p className="text-sm text-slate-500">
              {Math.round((coding.accepted / coding.total_submissions) * 100)}% acceptance
            </p>
          </div>
        </div>
      )}

      {/* Topic Performance */}
      {topics.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            Topic Performance
          </h3>
          <div className="space-y-3">
            {topics.map((t) => (
              <div key={t.topic}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{practiceTopicLabel(t.topic)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{t.sessions} sessions</span>
                    <span
                      className={`text-sm font-bold ${
                        Number(t.avg_score) >= 70
                          ? "text-green-600"
                          : Number(t.avg_score) >= 40
                          ? "text-amber-600"
                          : "text-red-500"
                      }`}
                    >
                      {t.avg_score}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div
                    className={`h-1.5 rounded-full ${
                      Number(t.avg_score) >= 70
                        ? "bg-green-500"
                        : Number(t.avg_score) >= 40
                        ? "bg-amber-400"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${t.avg_score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QuizMode ─────────────────────────────────────────────────────────────────

function QuizMode({
  bookmarkQuestionIds,
  onBookmarkSessionConsumed,
}: {
  bookmarkQuestionIds?: string[] | null;
  onBookmarkSessionConsumed?: () => void;
} = {}) {
  // Deep-link: ?topic=aptitude&difficulty=easy
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setCurrentObject } = useLearningCompanion();
  const [step, setStep] = useState<"setup" | "playing" | "done">("setup");
  const initialTopic = (() => {
    const raw = searchParams.get("topic") ?? "";
    // Accept label or bank category
    const hit = studentPracticeService.phase1Domains.find(
      (d) =>
        d.bankCategory === raw ||
        d.value === raw ||
        d.label.toLowerCase() === raw.toLowerCase()
    );
    return hit?.bankCategory || raw;
  })();
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [difficulty, setDifficulty] = useState<string>(searchParams.get("difficulty") ?? "mixed");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [retryMode, setRetryMode] = useState(false);

  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{
    is_correct: boolean;
    correct_answer: string;
    explanation: string;
  } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [hintOpen, setHintOpen] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [incorrectIds, setIncorrectIds] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const { data: topics } = useQuery({
    queryKey: ["practice-topics"],
    queryFn: () => studentPracticeService.getTopics(),
  });

  useQuery({
    queryKey: ["practice-bookmarks"],
    queryFn: async () => {
      const rows = await studentPracticeService.listBookmarks();
      setBookmarked(new Set(rows.map((r) => r.question_id)));
      return rows;
    },
  });

  const { data: incorrectList } = useQuery({
    queryKey: ["practice-incorrect", selectedTopic],
    queryFn: () => studentPracticeService.listIncorrect(selectedTopic || undefined),
  });

  useEffect(() => {
    setIncorrectIds((incorrectList || []).map((r: { id: string }) => r.id));
  }, [incorrectList]);

  const currentQuestion = questions[currentIdx];
  useEffect(() => {
    if (currentQuestion) {
      setCurrentObject({
        id: currentQuestion.id,
        label: currentQuestion.question_text.slice(0, 60),
      });
    }
  }, [currentQuestion?.id, setCurrentObject]);

  const resetPlayState = (data: { session: any; questions: Question[] }) => {
    setSession(data.session);
    setQuestions(data.questions);
    setCurrentIdx(0);
    setAnswerResult(null);
    setSelectedAnswer(null);
    setScore({ correct: 0, total: 0 });
    setHintOpen(false);
    setHintUsed(false);
    setStep("playing");
  };

  const startSession = useMutation({
    mutationFn: async (opts?: { question_ids?: string[] }) =>
      studentPracticeService.startSession({
        session_type: "quiz",
        topic: selectedTopic || undefined,
        difficulty,
        question_count: questionCount,
        retry_incorrect: retryMode && !opts?.question_ids?.length,
        question_ids: opts?.question_ids,
      }),
    onSuccess: (data) => {
      resetPlayState(data);
      onBookmarkSessionConsumed?.();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || "Failed to start session"),
  });

  useEffect(() => {
    if (bookmarkQuestionIds && bookmarkQuestionIds.length > 0 && step === "setup") {
      startSession.mutate({ question_ids: bookmarkQuestionIds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once when bookmark ids arrive
  }, [bookmarkQuestionIds]);

  useEffect(() => {
    const raw = searchParams.get("topic") ?? "";
    if (!raw) return;
    const hit = studentPracticeService.phase1Domains.find(
      (d) =>
        d.bankCategory === raw ||
        d.value === raw ||
        d.label.toLowerCase() === raw.toLowerCase()
    );
    if (hit) setSelectedTopic(hit.bankCategory);
  }, [searchParams]);

  const submitAnswer = useMutation({
    mutationFn: async (answer: string) =>
      studentPracticeService.submitAnswer(session.id, {
        question_id: questions[currentIdx].id,
        student_answer: answer,
        time_spent_seconds: 30,
        hint_used: hintUsed,
      }),
    onSuccess: (data) => {
      setAnswerResult(data);
      setScore((s) => ({
        correct: s.correct + (data.is_correct ? 1 : 0),
        total: s.total + 1,
      }));
    },
    onError: () => toast.error("Failed to submit answer"),
  });

  const completeSession = useMutation({
    mutationFn: async () => studentPracticeService.completeSession(session.id),
    onSuccess: () => setStep("done"),
  });

  const toggleBookmark = async () => {
    const qid = questions[currentIdx]?.id;
    if (!qid) return;
    try {
      if (bookmarked.has(qid)) {
        await studentPracticeService.removeBookmark(qid);
        setBookmarked((prev) => {
          const next = new Set(prev);
          next.delete(qid);
          return next;
        });
        toast.success("Bookmark removed");
      } else {
        await studentPracticeService.addBookmark(qid);
        setBookmarked((prev) => new Set(prev).add(qid));
        toast.success("Question bookmarked");
      }
    } catch {
      toast.error("Bookmark failed");
    }
  };

  const handleAnswer = (opt: string) => {
    if (!isOnline) {
      toast.error("You are offline — reconnect to submit answers");
      return;
    }
    if (answerResult || submitAnswer.isPending) return;
    setSelectedAnswer(opt);
    submitAnswer.mutate(opt);
  };

  const handlePrev = () => {
    if (currentIdx <= 0) return;
    setCurrentIdx((i) => i - 1);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setHintOpen(false);
    setHintUsed(false);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      if (!isOnline) {
        toast.error("You are offline — reconnect to finish the session");
        return;
      }
      completeSession.mutate();
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setHintOpen(false);
      setHintUsed(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 50) return;
    if (delta < 0 && answerResult) handleNext();
    if (delta > 0) handlePrev();
  };

  // ── Setup Screen ────────────────────────────────────────────────────────────
  if (step === "setup") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Brain className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Practice Set session</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Infinity className="h-3 w-3" /> Unlimited attempts · Instant feedback · Phase 1 domains
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Topic</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {(topics || []).map((t) => (
                <button
                  key={t.topic}
                  type="button"
                  onClick={() => setSelectedTopic(t.topic)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                    selectedTopic === t.topic
                      ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                      : "border-slate-200 text-slate-700 hover:border-indigo-300"
                  }`}
                >
                  <p className="font-semibold">{practiceTopicLabel(t.topic)}</p>
                  <p className="text-slate-400 mt-0.5">{t.total_questions} questions</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedTopic("")}
              className={`w-full rounded-lg border px-3 py-2 text-xs ${
                !selectedTopic
                  ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              All Phase-1 topics (mixed)
            </button>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Difficulty</label>
            <div className="flex gap-2">
              {["mixed", "easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    difficulty === d
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-300 text-slate-600 hover:border-indigo-400"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Questions: {questionCount}
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full accent-indigo-600"
              disabled={retryMode}
            />
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={retryMode}
              onChange={(e) => setRetryMode(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              <span className="text-sm font-medium text-slate-800 flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" /> Retry incorrect questions
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                {incorrectIds.length > 0
                  ? `${incorrectIds.length} incorrect available to retry`
                  : "Complete a session first to unlock retry"}
              </span>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => startSession.mutate()}
          disabled={startSession.isPending || (retryMode && incorrectIds.length === 0)}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {startSession.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {startSession.isPending
            ? "Starting…"
            : retryMode
              ? "Start retry session"
              : "Start Practice"}
        </button>
      </div>
    );
  }

  // ── Done Screen ─────────────────────────────────────────────────────────────
  if (step === "done") {
    const pct = questions.length > 0 ? Math.round((score.correct / questions.length) * 100) : 0;
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm mx-auto text-center">
        <div
          className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center mb-4 ${
            pct >= 70 ? "bg-green-100" : pct >= 40 ? "bg-amber-100" : "bg-red-100"
          }`}
        >
          <Trophy
            className={`h-10 w-10 ${
              pct >= 70 ? "text-green-600" : pct >= 40 ? "text-amber-500" : "text-red-500"
            }`}
          />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-1">{pct}%</h3>
        <p className="text-slate-500 mb-1">
          {score.correct} / {questions.length} correct
        </p>
        <p className="text-sm text-slate-400 mb-6">
          {pct >= 70 ? "Great work!" : pct >= 40 ? "Keep practising!" : "More practice needed"}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setRetryMode(score.correct < questions.length);
              setStep("setup");
              setSession(null);
              setQuestions([]);
            }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" />
            Practice again (unlimited)
          </button>
          {score.correct < questions.length && (
            <button
              type="button"
              onClick={() => {
                setRetryMode(true);
                setStep("setup");
                setSession(null);
                setQuestions([]);
              }}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Retry incorrect only
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Playing Screen ──────────────────────────────────────────────────────────
  const question = currentQuestion;
  const options: string[] = question?.options || [];
  const isBookmarked = question ? bookmarked.has(question.id) : false;

  if (!question) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">No questions in this session.</div>
    );
  }

  return (
    <div
      className="mx-auto max-w-2xl space-y-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {!isOnline && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-900"
        >
          Offline — answers stay selected locally; submit when you reconnect.
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-1 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:mx-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {currentIdx + 1} / {questions.length}
          </span>
          <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2.5 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-indigo-600">
            {score.correct} correct · {Math.round(((currentIdx + 1) / questions.length) * 100)}%
          </span>
        </div>
        <p className="text-[10px] font-medium text-slate-400 md:hidden">
          Swipe left for next (after answer) · swipe right for previous
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <DiffBadge level={question.difficulty_level} />
          <span className="text-xs text-slate-400">{practiceTopicLabel(question.category)}</span>
          <span className="text-xs text-slate-400">{question.marks} mark</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleBookmark()}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-700"
              title={isBookmarked ? "Remove bookmark" : "Bookmark question"}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {isBookmarked ? "Saved" : "Bookmark"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/student-portal/voice-tutor/${question.id}`)}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              title="Ask the AI Voice Tutor"
            >
              <Headphones className="h-3.5 w-3.5" /> AI Tutor
            </button>
          </div>
        </div>
        <p className="mb-4 font-medium leading-relaxed text-slate-800 dark:text-slate-100">
          {question.question_text}
        </p>

        {!answerResult && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                setHintOpen((v) => !v);
                setHintUsed(true);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {hintOpen ? "Hide hint" : "Show AI hint"}
            </button>
            {hintOpen && (
              <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {question.hint ||
                  "Focus on the core concept being tested — eliminate options that contradict the fundamentals."}
              </p>
            )}
          </div>
        )}

        {options.length > 0 ? (
          <div className="space-y-3">
            {options.map((opt, i) => {
              let cls =
                "w-full min-h-12 text-left px-4 py-3.5 rounded-xl border text-sm transition-colors cursor-pointer";
              if (answerResult) {
                if (opt === answerResult.correct_answer) {
                  cls += " bg-green-50 border-green-400 text-green-800 font-medium";
                } else if (opt === selectedAnswer && !answerResult.is_correct) {
                  cls += " bg-red-50 border-red-400 text-red-800";
                } else {
                  cls += " border-slate-200 text-slate-500";
                }
              } else {
                cls +=
                  selectedAnswer === opt
                    ? " border-indigo-500 bg-indigo-50"
                    : " border-slate-200 hover:border-indigo-400 active:bg-slate-50";
              }
              return (
                <button key={i} type="button" className={cls} onClick={() => handleAnswer(opt)}>
                  <span className="mr-2 font-semibold text-slate-400">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">No options available for this question.</p>
        )}

        {answerResult && (
          <div
            className={`mt-4 rounded-xl border p-4 ${
              answerResult.is_correct
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              {answerResult.is_correct ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span
                className={`text-sm font-semibold ${
                  answerResult.is_correct ? "text-green-700" : "text-red-700"
                }`}
              >
                {answerResult.is_correct ? "Correct!" : "Incorrect"}
              </span>
            </div>
            {answerResult.explanation && (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium">AI explanation: </span>
                {answerResult.explanation}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIdx <= 0}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        {answerResult ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={completeSession.isPending || !isOnline}
            className="inline-flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {currentIdx + 1 >= questions.length ? (
              <>
                <Trophy className="h-4 w-4" />
                {completeSession.isPending ? "Saving…" : "Finish & See Results"}
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex min-h-12 flex-[2] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400"
          >
            Answer to continue
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CodingArena (Coding Assessments · Python & Java only) ───────────────────

const CODING_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
] as const;

function CodingAssessmentsStrip({
  onOpenDrive,
}: {
  onOpenDrive: (driveId: string, topic?: string) => void;
}) {
  const { data: sets = [] } = useQuery({
    queryKey: ["available-coding-assessments"],
    queryFn: async () => {
      const { data } = await api.get("/exam-sessions/available-mocks");
      const rows = (data.data || []) as Array<{
        drive_id: string;
        drive_name: string;
        drive_type: string;
        duration_minutes: number;
        total_questions: number;
        phase1_domain?: string | null;
        bank_category?: string | null;
        placement_domain?: string | null;
      }>;
      return rows.filter((r) => r.drive_type === "coding_assessment");
    },
  });

  if (sets.length === 0) return null;

  return (
    <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-teal-700" />
          Coding Assessments
        </h2>
        <p className="text-[11px] text-slate-500">From Templates · Knowledge Library challenges</p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sets.slice(0, 6).map((s) => {
          const topicRaw = s.bank_category || s.placement_domain || s.phase1_domain || "";
          const topic = phase1DomainByValue(topicRaw)?.bankCategory || topicRaw;
          return (
            <li key={s.drive_id}>
              <button
                type="button"
                onClick={() => onOpenDrive(s.drive_id, topic)}
                className="w-full rounded-xl border border-teal-200/80 bg-white px-3 py-2.5 text-left hover:border-teal-400 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 line-clamp-1">{s.drive_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {practiceTopicLabel(topic)} · {s.total_questions} Q · {s.duration_minutes} min
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CodingArena() {
  const [searchParams, setSearchParams] = useSearchParams();
  const driveId = searchParams.get("drive_id") || "";
  const topicFromUrl = searchParams.get("topic") || "";
  const [selectedProblem, setSelectedProblem] = useState<CodingProblem | null>(null);
  const [diffFilter, setDiffFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>(
    topicFromUrl === "python_coding" || topicFromUrl === "java_coding" ? topicFromUrl : ""
  );
  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<string>(
    topicFromUrl === "java_coding" ? "java" : "python"
  );
  const [stdin, setStdin] = useState<string>("");
  const [runResult, setRunResult] = useState<any>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"review" | "hint" | "explain" | null>(null);
  const [activePanel, setActivePanel] = useState<"output" | "stdin" | "ai">("output");

  useEffect(() => {
    if (topicFromUrl === "python_coding" || topicFromUrl === "java_coding") {
      setTopicFilter(topicFromUrl);
      setLanguage(topicFromUrl === "java_coding" ? "java" : "python");
    }
  }, [topicFromUrl]);

  const { data: problems, isLoading } = useQuery({
    queryKey: ["coding-problems", diffFilter, topicFilter, driveId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (diffFilter) params.set("difficulty", diffFilter);
      if (topicFilter) params.set("topic", topicFilter);
      if (driveId) params.set("drive_id", driveId);
      const { data } = await api.get(`/practice/coding/problems?${params}`);
      return data.data as CodingProblem[];
    },
  });

  const runCode = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/practice/coding/run", {
        source_code: code,
        language,
        stdin,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setRunResult(data);
      setSubmitResult(null);
      setActivePanel("output");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || "Code execution failed"),
  });

  const submitCode = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/practice/coding/submit", {
        question_id: selectedProblem!.id,
        source_code: code,
        language,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setSubmitResult(data);
      setRunResult(null);
      setActivePanel("output");
      if (data.status === "accepted") {
        toast.success(`Accepted! Score ${data.score ?? 100}%`);
      } else {
        toast.error(
          `${String(data.status).replace(/_/g, " ")}: ${data.passed}/${data.total} · score ${data.score ?? 0}%`
        );
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Submission failed"),
  });

  const aiAssist = useMutation({
    mutationFn: async (mode: "review" | "hint" | "explain") => {
      const { data } = await api.post("/practice/coding/ai", {
        mode,
        question_id: selectedProblem!.id,
        source_code: code || undefined,
        language,
      });
      return { mode, ...(data.data as { text: string; source: string }) };
    },
    onSuccess: (data) => {
      setAiMode(data.mode);
      setAiText(data.text);
      setActivePanel("ai");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "AI assist failed"),
  });

  const selectProblem = async (p: CodingProblem) => {
    try {
      const { data } = await api.get(`/practice/coding/problems/${p.id}`);
      const full = data.data as CodingProblem;
      setSelectedProblem(full);
      const lang =
        full.category === "java_coding"
          ? "java"
          : full.category === "python_coding"
            ? "python"
            : language;
      setLanguage(lang);
      setCode(pickStarter(full.starter_code, lang));
      const sample = full.sample_tests?.[0];
      setStdin(sample?.input || "");
      setRunResult(null);
      setSubmitResult(null);
      setAiText(null);
      setAiMode(null);
    } catch {
      setSelectedProblem(p);
      setCode(pickStarter(p.starter_code, language));
      setRunResult(null);
      setSubmitResult(null);
    }
  };

  const clearDriveFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("drive_id");
    setSearchParams(next, { replace: true });
  };

  if (!selectedProblem) {
    return (
      <div className="space-y-4">
        <CodingAssessmentsStrip
          onOpenDrive={(id, topic) => {
            const next = new URLSearchParams(searchParams);
            next.set("tab", "coding");
            next.set("drive_id", id);
            if (topic) next.set("topic", topic);
            setSearchParams(next, { replace: true });
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-600">Language:</span>
          {[
            { id: "", label: "All" },
            { id: "python_coding", label: "Python" },
            { id: "java_coding", label: "Java" },
          ].map((t) => (
            <button
              key={t.id || "all"}
              type="button"
              onClick={() => setTopicFilter(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                topicFilter === t.id
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-slate-300 text-slate-600 hover:border-teal-400"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="text-sm text-slate-600 ml-2">Difficulty:</span>
          {["", "easy", "medium", "hard"].map((d) => (
            <button
              key={d || "all-d"}
              type="button"
              onClick={() => setDiffFilter(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors capitalize ${
                diffFilter === d
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-slate-300 text-slate-600 hover:border-indigo-400"
              }`}
            >
              {d || "All"}
            </button>
          ))}
          {driveId && (
            <button
              type="button"
              onClick={clearDriveFilter}
              className="ml-auto text-xs font-medium text-teal-700 hover:underline"
            >
              Clear assessment filter
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Knowledge Library coding challenges · run code · hidden tests on submit · AI review /
          hints / explain · score = % tests passed.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : (problems || []).length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <Code2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No coding problems found</p>
            <p className="text-xs text-slate-400 mt-1">
              Seed Python/Java coding_challenge items in Knowledge Library.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {(problems || []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProblem(p)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {practiceTopicLabel(p.category)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <DiffBadge level={p.difficulty_level} />
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSelectedProblem(null)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Problems
        </button>
        <div className="h-4 w-px bg-slate-300" />
        <span className="font-semibold text-slate-800 truncate">{selectedProblem.title}</span>
        <DiffBadge level={selectedProblem.difficulty_level} />
        {(selectedProblem.hidden_test_count ?? 0) > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {selectedProblem.hidden_test_count} hidden tests
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Problem</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {selectedProblem.question_text || selectedProblem.title}
          </p>
          {(selectedProblem.sample_tests || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Sample tests
              </p>
              <ul className="space-y-2">
                {selectedProblem.sample_tests!.map((tc, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-xs font-mono">
                    <p className="text-slate-400 mb-0.5">Input</p>
                    <pre className="text-slate-700 whitespace-pre-wrap">{tc.input}</pre>
                    <p className="text-slate-400 mt-2 mb-0.5">Expected</p>
                    <pre className="text-slate-700 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(selectedProblem.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedProblem.tags!.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {(
              [
                { mode: "hint" as const, label: "AI Hint", icon: Lightbulb },
                { mode: "explain" as const, label: "AI Explain", icon: BookOpen },
                { mode: "review" as const, label: "AI Review", icon: Sparkles },
              ] as const
            ).map((a) => (
              <button
                key={a.mode}
                type="button"
                disabled={aiAssist.isPending || (a.mode === "review" && !code)}
                onClick={() => aiAssist.mutate(a.mode)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 disabled:opacity-50"
              >
                <a.icon className="h-3.5 w-3.5" />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={language}
              onChange={(e) => {
                const next = e.target.value;
                setLanguage(next);
                setCode(pickStarter(selectedProblem.starter_code, next));
              }}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CODING_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => runCode.mutate()}
              disabled={!code || runCode.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {runCode.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Run
            </button>
            <button
              type="button"
              onClick={() => submitCode.mutate()}
              disabled={!code || submitCode.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitCode.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Submit
            </button>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full font-mono text-sm bg-slate-900 text-slate-100 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Write your Python or Java solution..."
          />

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200">
              {[
                { id: "output" as const, label: "Output", icon: Terminal },
                { id: "stdin" as const, label: "Custom Input", icon: Send },
                { id: "ai" as const, label: "AI Assist", icon: Sparkles },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePanel(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activePanel === tab.id
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-3">
              {activePanel === "stdin" ? (
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  rows={4}
                  className="w-full font-mono text-xs bg-slate-50 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Enter custom input..."
                />
              ) : activePanel === "ai" ? (
                <div className="text-sm text-slate-700 min-h-[80px] whitespace-pre-wrap">
                  {aiAssist.isPending ? (
                    <p className="text-slate-400 italic">Thinking…</p>
                  ) : aiText ? (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-2">
                        {aiMode}
                      </p>
                      {aiText}
                    </>
                  ) : (
                    <p className="text-slate-400 italic">
                      Use AI Hint, Explain, or Review above.
                    </p>
                  )}
                </div>
              ) : (
                <div className="font-mono text-xs text-slate-700 min-h-[80px] whitespace-pre-wrap">
                  {runResult ? (
                    <>
                      {runResult.stdout && <p className="text-green-700">{runResult.stdout}</p>}
                      {runResult.stderr && <p className="text-red-500">{runResult.stderr}</p>}
                      {(runResult.compileOutput || runResult.compile_output) && (
                        <p className="text-amber-600">
                          {runResult.compileOutput || runResult.compile_output}
                        </p>
                      )}
                      {!runResult.stdout &&
                        !runResult.stderr &&
                        !runResult.compileOutput &&
                        !runResult.compile_output && (
                          <p className="text-slate-400 italic">(no output)</p>
                        )}
                    </>
                  ) : submitResult ? (
                    <div className="space-y-2">
                      <p
                        className={`font-semibold ${
                          submitResult.status === "accepted" ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {String(submitResult.status).replace(/_/g, " ").toUpperCase()}
                      </p>
                      <p className="text-slate-600">
                        Score:{" "}
                        <span className="font-bold text-indigo-600">
                          {submitResult.score ?? 0}%
                        </span>{" "}
                        · {submitResult.passed}/{submitResult.total} tests passed
                      </p>
                      {(submitResult.test_results || []).length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {submitResult.test_results.map((r: any, i: number) => (
                            <li
                              key={i}
                              className={`flex items-center gap-2 ${
                                r.passed ? "text-green-600" : "text-red-500"
                              }`}
                            >
                              {r.passed ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              Case {i + 1}
                              {r.hidden ? " (hidden)" : ""}: {r.passed ? "Pass" : r.status}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">Run your code to see output here</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BookmarksPanel ───────────────────────────────────────────────────────────

function BookmarksPanel({
  onPractice,
}: {
  onPractice: (ids: string[], topic?: string) => void;
}) {
  const { data: bookmarks = [], isLoading, refetch } = useQuery({
    queryKey: ["practice-bookmarks-list"],
    queryFn: () => studentPracticeService.listBookmarks(),
  });

  const remove = async (questionId: string) => {
    try {
      await studentPracticeService.removeBookmark(questionId);
      toast.success("Bookmark removed");
      void refetch();
    } catch {
      toast.error("Failed to remove bookmark");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <Bookmark className="h-8 w-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-600">No bookmarked questions yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Bookmark items during a Practice Set session to review them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{bookmarks.length} bookmarked</p>
        <button
          type="button"
          onClick={() =>
            onPractice(
              bookmarks.map((b) => b.question_id),
              bookmarks[0]?.category
            )
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Play className="h-3.5 w-3.5" />
          Practice bookmarked
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {bookmarks.map((b: PracticeBookmark) => (
          <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800 line-clamp-2">{b.question_text}</p>
              <p className="text-xs text-slate-400 mt-1">
                {practiceTopicLabel(b.category)} · {b.difficulty_level}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onPractice([b.question_id], b.category)}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Practice
              </button>
              <button
                type="button"
                onClick={() => void remove(b.question_id)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── PracticeSetsStrip ────────────────────────────────────────────────────────

function PracticeSetsStrip() {
  const navigate = useNavigate();
  const { data: sets = [] } = useQuery({
    queryKey: ["available-practice-sets"],
    queryFn: async () => {
      const { data } = await api.get("/exam-sessions/available-mocks");
      const rows = (data.data || []) as Array<{
        drive_id: string;
        drive_name: string;
        drive_type: string;
        duration_minutes: number;
        total_questions: number;
        phase1_domain?: string | null;
        bank_category?: string | null;
        placement_domain?: string | null;
      }>;
      return rows.filter((r) => r.drive_type === "practice_test");
    },
  });

  if (sets.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Infinity className="h-4 w-4 text-indigo-600" />
          Practice Sets
        </h2>
        <p className="text-[11px] text-slate-400">From Assessment Templates · unlimited</p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sets.slice(0, 6).map((s) => {
          const topicRaw = s.bank_category || s.placement_domain || s.phase1_domain || "";
          const topic = phase1DomainByValue(topicRaw)?.bankCategory || topicRaw;
          return (
            <li key={s.drive_id}>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    topic
                      ? `/app/student-portal/practice?topic=${encodeURIComponent(topic)}&tab=quiz`
                      : `/app/student-portal/practice?tab=quiz`
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 line-clamp-1">{s.drive_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {practiceTopicLabel(topic)} · {s.total_questions} Q · {s.duration_minutes} min
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PracticeTab = "quiz" | "coding" | "bookmarks" | "stats";

export default function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as PracticeTab) || "quiz";
  const [activeTab, setActiveTab] = useState<PracticeTab>(
    ["quiz", "coding", "bookmarks", "stats"].includes(initialTab) ? initialTab : "quiz"
  );
  const [bookmarkSessionIds, setBookmarkSessionIds] = useState<string[] | null>(null);

  const tabs: { id: PracticeTab; label: string; icon: typeof Brain }[] = [
    { id: "quiz", label: "Quiz", icon: Brain },
    { id: "coding", label: "Coding", icon: Code2 },
    { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
    { id: "stats", label: "My Stats", icon: BarChart3 },
  ];

  const switchTab = (id: PracticeTab) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Practice</p>
          <h1 className="text-2xl font-bold text-slate-900">Practice Hub</h1>
          <p className="text-sm text-slate-500 mt-1">
            Topic practice, practice sets, daily drills, and weak-topic review.
          </p>
        </div>
        <Link
          to="/app/student-portal/question-bank"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Question Library
        </Link>
      </div>

      <PracticeSetsStrip />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "quiz" && (
        <QuizMode
          bookmarkQuestionIds={bookmarkSessionIds}
          onBookmarkSessionConsumed={() => setBookmarkSessionIds(null)}
        />
      )}
      {activeTab === "coding" && <CodingArena />}
      {activeTab === "bookmarks" && (
        <BookmarksPanel
          onPractice={(ids, topic) => {
            if (topic) {
              const next = new URLSearchParams(searchParams);
              next.set("topic", topic);
              next.set("tab", "quiz");
              setSearchParams(next, { replace: true });
            }
            setBookmarkSessionIds(ids);
            setActiveTab("quiz");
          }}
        />
      )}
      {activeTab === "stats" && <StatsPanel />}
    </div>
  );
}
