// =============================================================================
// Student Practice Arena
// Quiz Mode · Coding Problems · Stats
// =============================================================================

import { useState } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";

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
}

interface CodingProblem {
  id: string;
  category: string;
  difficulty_level: string;
  title: string;
  marks: number;
  tags: string[] | null;
  starter_code: string | null;
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
                  <span className="text-sm text-slate-700 capitalize">{t.topic}</span>
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

function QuizMode() {
  const [step, setStep] = useState<"setup" | "playing" | "done">("setup");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("mixed");
  const [questionCount, setQuestionCount] = useState<number>(10);

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

  const { data: topics } = useQuery({
    queryKey: ["practice-topics"],
    queryFn: async () => {
      const { data } = await api.get("/practice/topics");
      return data.data as Topic[];
    },
  });

  const startSession = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/practice/sessions", {
        session_type: "quiz",
        topic: selectedTopic || undefined,
        difficulty,
        question_count: questionCount,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setSession(data.session);
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswerResult(null);
      setSelectedAnswer(null);
      setScore({ correct: 0, total: 0 });
      setStep("playing");
    },
    onError: () => toast.error("Failed to start session"),
  });

  const submitAnswer = useMutation({
    mutationFn: async (answer: string) => {
      const { data } = await api.post(`/practice/sessions/${session.id}/answer`, {
        question_id: questions[currentIdx].id,
        student_answer: answer,
        time_spent_seconds: 30,
        hint_used: false,
      });
      return data.data;
    },
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
    mutationFn: async () => {
      const { data } = await api.put(`/practice/sessions/${session.id}/complete`);
      return data.data;
    },
    onSuccess: () => setStep("done"),
  });

  const handleAnswer = (opt: string) => {
    if (answerResult || submitAnswer.isPending) return;
    setSelectedAnswer(opt);
    submitAnswer.mutate(opt);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      completeSession.mutate();
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedAnswer(null);
      setAnswerResult(null);
    }
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
            <h3 className="font-bold text-slate-800">Start a Quiz Session</h3>
            <p className="text-xs text-slate-500">Choose your focus area and difficulty</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Topic</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
            >
              <option value="">All Topics (Mixed)</option>
              {(topics || []).map((t) => (
                <option key={t.topic} value={t.topic}>
                  {t.topic} ({t.total_questions} questions)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Difficulty</label>
            <div className="flex gap-2">
              {["mixed", "easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
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
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>5</span>
              <span>30</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => startSession.mutate()}
          disabled={startSession.isPending}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {startSession.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {startSession.isPending ? "Starting…" : "Start Quiz"}
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
        <button
          onClick={() => {
            setStep("setup");
            setSession(null);
            setQuestions([]);
          }}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  // ── Playing Screen ──────────────────────────────────────────────────────────
  const question = questions[currentIdx];
  const options: string[] = question.options || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">
          Question {currentIdx + 1} / {questions.length}
        </span>
        <div className="flex-1 h-2 bg-slate-100 rounded-full">
          <div
            className="h-2 bg-indigo-500 rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-indigo-600">{score.correct} correct</span>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <DiffBadge level={question.difficulty_level} />
          <span className="text-xs text-slate-400 capitalize">{question.category}</span>
          <span className="ml-auto text-xs text-slate-400">{question.marks} mark</span>
        </div>
        <p className="text-slate-800 font-medium leading-relaxed mb-6">{question.question_text}</p>

        {options.length > 0 ? (
          <div className="space-y-3">
            {options.map((opt, i) => {
              let cls =
                "w-full text-left p-3 rounded-xl border text-sm transition-colors cursor-pointer";
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
                    : " border-slate-200 hover:border-indigo-400";
              }
              return (
                <button key={i} className={cls} onClick={() => handleAnswer(opt)}>
                  <span className="mr-2 font-semibold text-slate-400">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No options available for this question.</p>
        )}

        {answerResult && (
          <div
            className={`mt-4 p-4 rounded-xl border ${
              answerResult.is_correct
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
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
              <p className="text-sm text-slate-600">{answerResult.explanation}</p>
            )}
          </div>
        )}
      </div>

      {answerResult && (
        <button
          onClick={handleNext}
          disabled={completeSession.isPending}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700"
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
      )}
    </div>
  );
}

// ─── CodingArena ──────────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
];

function CodingArena() {
  const [selectedProblem, setSelectedProblem] = useState<CodingProblem | null>(null);
  const [diffFilter, setDiffFilter] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<string>("python");
  const [stdin, setStdin] = useState<string>("");
  const [runResult, setRunResult] = useState<any>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<"output" | "stdin">("output");

  const { data: problems, isLoading } = useQuery({
    queryKey: ["coding-problems", diffFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (diffFilter) params.set("difficulty", diffFilter);
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
    onError: () => toast.error("Code execution failed"),
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
      if (data.status === "accepted") toast.success("Accepted! All test cases passed.");
      else toast.error(`${data.status.replace(/_/g, " ")}: ${data.passed}/${data.total} passed`);
    },
    onError: () => toast.error("Submission failed"),
  });

  const selectProblem = (p: CodingProblem) => {
    setSelectedProblem(p);
    setCode(p.starter_code || "");
    setRunResult(null);
    setSubmitResult(null);
  };

  // Problem List
  if (!selectedProblem) {
    return (
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-600">Difficulty:</span>
          {["", "easy", "medium", "hard"].map((d) => (
            <button
              key={d}
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
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : (problems || []).length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <Code2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No coding problems found</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {(problems || []).map((p) => (
              <button
                key={p.id}
                onClick={() => selectProblem(p)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{p.category}</p>
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

  // Code Editor
  return (
    <div className="space-y-4">
      {/* Back + Problem header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedProblem(null)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Problems
        </button>
        <div className="h-4 w-px bg-slate-300" />
        <span className="font-semibold text-slate-800 truncate">{selectedProblem.title}</span>
        <DiffBadge level={selectedProblem.difficulty_level} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Problem */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Problem</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {selectedProblem.title}
          </p>
          {(selectedProblem.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
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
        </div>

        {/* Right: Editor */}
        <div className="space-y-3">
          {/* Language selector */}
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="flex-1" />
            <button
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

          {/* Code textarea */}
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full font-mono text-sm bg-slate-900 text-slate-100 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Write your solution here..."
          />

          {/* Stdin / Output tabs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200">
              {[
                { id: "output", label: "Output", icon: Terminal },
                { id: "stdin", label: "Custom Input", icon: Send },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivePanel(tab.id as any)}
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
              ) : (
                <div className="font-mono text-xs text-slate-700 min-h-[80px] whitespace-pre-wrap">
                  {runResult ? (
                    <>
                      {runResult.stdout && (
                        <p className="text-green-700">{runResult.stdout}</p>
                      )}
                      {runResult.stderr && (
                        <p className="text-red-500">{runResult.stderr}</p>
                      )}
                      {runResult.compile_output && (
                        <p className="text-amber-600">{runResult.compile_output}</p>
                      )}
                      {!runResult.stdout && !runResult.stderr && !runResult.compile_output && (
                        <p className="text-slate-400 italic">(no output)</p>
                      )}
                    </>
                  ) : submitResult ? (
                    <div className="space-y-1">
                      <p
                        className={`font-semibold ${
                          submitResult.status === "accepted"
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {submitResult.status.replace(/_/g, " ").toUpperCase()}
                      </p>
                      <p className="text-slate-500">
                        {submitResult.passed} / {submitResult.total} test cases passed
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">
                      Run your code to see output here
                    </p>
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

// ─── Main Component ───────────────────────────────────────────────────────────

type PracticeTab = "quiz" | "coding" | "stats";

export default function PracticePage() {
  const [activeTab, setActiveTab] = useState<PracticeTab>("quiz");

  const tabs: { id: PracticeTab; label: string; icon: typeof Brain }[] = [
    { id: "quiz", label: "Quiz", icon: Brain },
    { id: "coding", label: "Coding", icon: Code2 },
    { id: "stats", label: "My Stats", icon: BarChart3 },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Practice Arena</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sharpen your skills with quizzes and coding challenges
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {activeTab === "quiz" && <QuizMode />}
      {activeTab === "coding" && <CodingArena />}
      {activeTab === "stats" && <StatsPanel />}
    </div>
  );
}
