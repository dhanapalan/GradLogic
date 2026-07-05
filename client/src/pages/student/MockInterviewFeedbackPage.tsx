// =============================================================================
// Mock Interview Feedback Page
// Shows Claude-generated analysis after a voice AI interview session
// =============================================================================

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../lib/api";
import {
  CheckCircle2, AlertTriangle, TrendingUp, BookOpen,
  Mic, ArrowLeft, RefreshCw, Clock, Star,
  ChevronRight, Zap, MessageSquareQuote, Layers, CheckCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecommendedProgram {
  id: string;
  name: string;
  description: string;
  program_type: string;
  duration_days: number | null;
  module_count: number;
  enrollment_count: number;
  already_enrolled: boolean;
  matched_gaps: { skill: string; priority: string }[];
}

interface Feedback {
  overall_score: number;
  communication_score: number;
  technical_score: number;
  confidence_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  skill_gaps: { skill: string; priority: "high" | "medium" | "low" }[];
  transcript_highlights: { time_approx: string; quote: string; note: string }[];
  recommended_courses: { title: string; reason: string }[];
  target_role: string;
  difficulty: string;
  duration_seconds: number;
  completed_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={radius} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800">
          {score}
        </span>
      </div>
      <span className="text-[10px] font-semibold text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-rose-50 text-rose-600 border-rose-200",
    medium: "bg-amber-50 text-amber-600 border-amber-200",
    low: "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function fmtDuration(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MockInterviewFeedbackPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["interview-feedback", sessionId],
    queryFn: async () => {
      const res = await api.get(`/mock-interviews/${sessionId}/feedback`);
      return res.data;
    },
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d?.data && d?.status === "completed") return 3000;
      return false;
    },
    staleTime: 0,
  });

  const feedback: Feedback | null = data?.data ?? null;
  const sessionStatus: string = data?.status ?? "";

  // Fetch matched LMS programs once feedback is ready
  const { data: programsData } = useQuery({
    queryKey: ["interview-programs", sessionId],
    queryFn: async () => {
      const res = await api.get(`/mock-interviews/${sessionId}/recommended-programs`);
      return res.data.data as RecommendedProgram[];
    },
    enabled: !!feedback,   // only fetch once feedback is available
    staleTime: 60_000,
  });
  const programs: RecommendedProgram[] = programsData ?? [];

  const enrollMutation = useMutation({
    mutationFn: (programId: string) =>
      api.post(`/student-learning/enroll/${programId}`),
    onMutate: (programId) => setEnrollingId(programId),
    onSuccess: (_res, programId) => {
      toast.success("Enrolled successfully!");
      queryClient.setQueryData(
        ["interview-programs", sessionId],
        (old: RecommendedProgram[] | undefined) =>
          old?.map(p => p.id === programId ? { ...p, already_enrolled: true } : p)
      );
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Enrolment failed"),
    onSettled: () => setEnrollingId(null),
  });

  // Redirect if session not found
  useEffect(() => {
    if (data && !feedback && sessionStatus === "pending") {
      // No call was ever made — go back to launcher
      navigate("/app/student-portal/mock-interview", { replace: true });
    }
  }, [data, feedback, sessionStatus]);

  // ── Loading / generating state ─────────────────────────────────────────────
  if (isLoading || (!feedback && sessionStatus === "completed")) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="h-8 w-8 text-indigo-500" />
          </div>
          <h2 className="text-slate-800 text-lg font-bold mb-2">Analysing your interview…</h2>
          <p className="text-slate-400 text-sm mb-6">Claude is reviewing your transcript and generating personalised feedback. This takes about 15–30 seconds.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 mx-auto text-indigo-600 text-sm font-semibold hover:underline"
          >
            <RefreshCw className="h-4 w-4" /> Check now
          </button>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Feedback not found.</p>
          <Link to="/app/student-portal/mock-interview" className="text-indigo-600 text-sm font-semibold hover:underline">
            Start a new interview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-4 md:px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate("/app/student-portal/mock-interview")}
          className="text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-slate-900 truncate">
            {feedback.target_role} Interview — Feedback
          </h1>
          <p className="text-xs text-slate-400 capitalize">
            {feedback.difficulty} · {fmtDuration(feedback.duration_seconds)} ·{" "}
            {feedback.completed_at ? new Date(feedback.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </p>
        </div>
        <Link
          to="/app/student-portal/mock-interview"
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors shrink-0"
        >
          <Mic className="h-3.5 w-3.5" /> New Interview
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Score card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-xs font-semibold mb-1">Overall Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black">{feedback.overall_score}</span>
                  <span className="text-indigo-300 text-lg mb-1">/100</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-indigo-200 text-xs font-semibold mb-1">Performance</p>
                <span className={`text-lg font-black ${feedback.overall_score >= 75 ? "text-emerald-300" : feedback.overall_score >= 50 ? "text-amber-300" : "text-rose-300"}`}>
                  {feedback.overall_score >= 75 ? "Strong" : feedback.overall_score >= 50 ? "Good" : "Needs Work"}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex justify-around">
              <ScoreRing score={feedback.communication_score} label="Communication" color="#6366f1" />
              <ScoreRing score={feedback.technical_score} label="Technical" color="#8b5cf6" />
              <ScoreRing score={feedback.confidence_score} label="Confidence" color="#06b6d4" />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-400" /> Summary
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">{feedback.summary}</p>
        </div>

        {/* Strengths + Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
            <h2 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
            </h2>
            <ul className="space-y-2.5">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
            <h2 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Improve
            </h2>
            <ul className="space-y-2.5">
              {feedback.improvements.map((imp, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Transcript highlights */}
        {feedback.transcript_highlights?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <MessageSquareQuote className="h-3.5 w-3.5 text-indigo-400" /> Key Moments
            </h2>
            <div className="space-y-3">
              {feedback.transcript_highlights.map((h, i) => (
                <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="shrink-0">
                    <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5">
                      <Clock className="h-3 w-3" /> {h.time_approx}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 italic mb-1 truncate">"{h.quote}"</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{h.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill gaps */}
        {feedback.skill_gaps?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-rose-400" /> Skill Gaps
            </h2>
            <div className="flex flex-wrap gap-2">
              {feedback.skill_gaps.map((sg, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <span className="text-sm text-slate-700 font-medium">{sg.skill}</span>
                  <PriorityBadge priority={sg.priority} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Learning — real LMS programs matched from skill gaps */}
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Recommended Learning
            </h2>
            {programs.length > 0 && (
              <span className="text-[10px] text-indigo-400 font-semibold">{programs.length} program{programs.length !== 1 ? "s" : ""} matched</span>
            )}
          </div>

          {programs.length > 0 ? (
            <div className="space-y-3">
              {programs.map((prog) => (
                <div key={prog.id} className="flex items-start gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  {/* icon */}
                  <div className="w-9 h-9 shrink-0 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                    <Layers className="h-4 w-4" />
                  </div>

                  {/* details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{prog.name}</p>
                    {prog.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{prog.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {prog.module_count} modules
                      </span>
                      {prog.duration_days && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {prog.duration_days}d
                        </span>
                      )}
                      {/* matched gap chips */}
                      {prog.matched_gaps.slice(0, 2).map((g, i) => (
                        <span key={i} className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                          {g.skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* enroll / enrolled */}
                  {prog.already_enrolled ? (
                    <span className="shrink-0 flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCheck className="h-3.5 w-3.5" /> Enrolled
                    </span>
                  ) : (
                    <button
                      onClick={() => enrollMutation.mutate(prog.id)}
                      disabled={enrollingId === prog.id}
                      className="shrink-0 flex items-center gap-1 text-indigo-600 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors disabled:opacity-50"
                    >
                      {enrollingId === prog.id
                        ? <span className="h-3 w-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                      Enroll
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Fallback to Claude's text suggestions when no DB programs match */
            feedback.recommended_courses?.length > 0 ? (
              <div className="space-y-3">
                {feedback.recommended_courses.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-7 h-7 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 text-xs font-black">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.reason}</p>
                    </div>
                    <Link to="/app/student-portal/programs" className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
                <p className="text-xs text-slate-400 text-center pt-1">
                  No matching programs found yet.{" "}
                  <Link to="/app/student-portal/programs" className="text-indigo-500 hover:underline">Browse all programs →</Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                No programs available yet.{" "}
                <Link to="/app/student-portal/programs" className="text-indigo-500 hover:underline">Browse all programs →</Link>
              </p>
            )
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Link
            to="/app/student-portal/mock-interview"
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-200"
          >
            <Mic className="h-4 w-4" /> Practice Again
          </Link>
          <Link
            to="/app/student-portal/development"
            className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 transition-colors"
          >
            <TrendingUp className="h-4 w-4" /> View Development Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
