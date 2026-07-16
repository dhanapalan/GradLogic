// =============================================================================
// AI Learning Companion — Admin product hub (flagship)
//
// Frames Companion as teacher / mentor / tutor / assistant — not a chatbot —
// and maps live capabilities vs the development order so product review is
// honest and actionable.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  MessageSquareText,
  Mic,
  Dumbbell,
  Code2,
  Compass,
  Lightbulb,
  Search,
  History,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  Circle,
  Library,
  Wand2,
  ClipboardCheck,
} from "lucide-react";
import questionBankService from "../../../services/questionBankService";
import superadminFeaturesService from "../../../services/superadminFeaturesService";

type Status = "live" | "partial" | "planned";

interface Capability {
  name: string;
  purpose: string;
  features: string[];
  status: Status;
  href?: string;
  studentHref?: string;
  icon: typeof Sparkles;
}

const CAPABILITIES: Capability[] = [
  {
    name: "AI Tutor (Chat / Explain)",
    purpose: "Explain, simplify, beginner/advanced/interview explanations, real-world examples.",
    features: [
      "Explain concepts",
      "Simplify / beginner mode",
      "Advanced & interview explanations",
      "Real-world examples",
      "Multi-turn Why? / How? mentor chat",
    ],
    status: "partial",
    href: "/app/superadmin/learning-companion/knowledge-engine",
    studentHref: "/app/student-portal/voice-tutor",
    icon: MessageSquareText,
  },
  {
    name: "Voice Tutor",
    purpose: "Listen, speak, pause/resume, replay, speed, language, and voice selection.",
    features: [
      "Listen / barge-in interrupt",
      "Explain, hint, example, translate, ask",
      "Multi-language (en/ta/hi/ml/te)",
      "Voice selection (admin Voice Studio)",
      "Pause / resume / speed (planned polish)",
    ],
    status: "partial",
    href: "/app/superadmin/voice-studio/tutor-voices",
    studentHref: "/app/student-portal",
    icon: Mic,
  },
  {
    name: "AI Practice",
    purpose: "Generate practice: MCQs, coding, case studies, flashcards, quick quizzes.",
    features: [
      "Content Generator (MCQ / flashcards / lessons)",
      "Practice sets & mock tests",
      "Coding challenges",
      "Case studies (manual library)",
      "Quick quizzes (partial via practice)",
    ],
    status: "partial",
    href: "/app/superadmin/learning-companion/studio",
    studentHref: "/app/student-portal/practice",
    icon: Dumbbell,
  },
  {
    name: "AI Coding Mentor",
    purpose: "Explain, debug, optimize, generate, review code and errors.",
    features: [
      "Coding challenges in library",
      "Coding version improver",
      "Explain / debug / optimize (planned deep mentor UI)",
      "Error explanation (planned)",
    ],
    status: "partial",
    href: "/app/superadmin/coding-assessments",
    icon: Code2,
  },
  {
    name: "AI Recommendations",
    purpose: "Next lesson, weak topics, practice, mock test, revision.",
    features: [
      "Adaptive learning path (student)",
      "Weak-skill recommendations",
      "Next practice / lesson suggestions",
      "Mock test recommendations (thin)",
    ],
    status: "partial",
    href: "/app/superadmin/analytics/skills",
    studentHref: "/app/student-portal/adaptive-learning",
    icon: Lightbulb,
  },
  {
    name: "AI Search",
    purpose: "Semantic search — “Explain Java Collections”, SQL JOINs, DSA Trees…",
    features: [
      "Semantic / hybrid search",
      "Example natural-language queries",
      "Embedding-backed ranking when available",
    ],
    status: "live",
    href: "/app/superadmin/ai-studio/embeddings",
    studentHref: "/app/student-portal/ai-search",
    icon: Search,
  },
  {
    name: "AI Conversation History",
    purpose: "Saved conversations, bookmarks, notes, favorites.",
    features: [
      "In-session Voice Tutor history",
      "Saved conversations (planned)",
      "Bookmarks / notes / favorites (planned)",
    ],
    status: "planned",
    icon: History,
  },
  {
    name: "Adaptive Learning",
    purpose: "Close the loop: track → recommend → path → practice.",
    features: [
      "Skill accuracy tracking",
      "Live learning path",
      "Difficulty-aware next step",
    ],
    status: "partial",
    studentHref: "/app/student-portal/adaptive-learning",
    href: "/app/superadmin/analytics/skills",
    icon: Compass,
  },
];

const ROADMAP = [
  { label: "Chat", detail: "Scoped mentor conversation" },
  { label: "Explain", detail: "Beginner → advanced → interview" },
  { label: "Voice", detail: "Listen / speak / multi-language" },
  { label: "Practice", detail: "Generate + attempt loops" },
  { label: "Recommendations", detail: "Weak topics → next action" },
  { label: "Coding Mentor", detail: "Debug / review / optimize" },
  { label: "Adaptive Learning", detail: "Personalized path" },
];

const STATUS_META: Record<Status, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  live: { label: "Live", className: "bg-emerald-50 text-emerald-700 border-emerald-100", Icon: CheckCircle2 },
  partial: { label: "Partial", className: "bg-amber-50 text-amber-700 border-amber-100", Icon: CircleDashed },
  planned: { label: "Planned", className: "bg-slate-50 text-slate-500 border-slate-200", Icon: Circle },
};

export default function LearningCompanionDashboard() {
  const [counts, setCounts] = useState({ questions: 0, lessons: 0, flashcards: 0, pending: 0 });

  useEffect(() => {
    Promise.all([
      questionBankService.searchQuestions({ limit: 1 }).catch(() => ({ total: 0 })),
      superadminFeaturesService.listLessons().catch(() => []),
      superadminFeaturesService.listFlashcards().catch(() => []),
      questionBankService.getReviewQueue(1, 1).catch(() => ({ total: 0 })),
    ]).then(([mcq, lessons, flashcards, review]) => {
      setCounts({
        questions: mcq.total || 0,
        lessons: Array.isArray(lessons) ? lessons.length : 0,
        flashcards: Array.isArray(flashcards) ? flashcards.length : 0,
        pending: review.total || 0,
      });
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-navy-900/10 bg-gradient-to-br from-navy-900 to-slate-800 text-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Flagship · Learning Hub</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-amber-300" />
          AI Learning Companion
        </h1>
        <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/75 leading-relaxed">
          Not a chatbot — an AI teacher, mentor, tutor, and learning assistant. It explains,
          listens, practices, recommends, and adapts around the Knowledge Library.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/app/superadmin/knowledge-library"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-navy-900"
            >
              <Library className="w-4 h-4" /> Knowledge Library
            </Link>
          <Link
            to="/app/superadmin/learning-companion/studio"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            <Wand2 className="w-4 h-4" /> Generate content
          </Link>
          <Link
            to="/app/superadmin/learning-companion/review"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            <ClipboardCheck className="w-4 h-4" /> Review Center
          </Link>
        </div>
      </div>

      {/* Library snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Lessons", value: counts.lessons, href: "/app/superadmin/knowledge-library/assets/lessons" },
          { label: "Questions", value: counts.questions, href: "/app/superadmin/knowledge-library/assets/questions" },
          { label: "Flashcards", value: counts.flashcards, href: "/app/superadmin/library/flashcards" },
          { label: "Pending review", value: counts.pending, href: "/app/superadmin/learning-companion/review" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.href}
            className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card hover:border-gray-300"
          >
            <p className="text-xs uppercase tracking-wide text-gray-400">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Development order */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Development order</h2>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {ROADMAP.map((step, i) => (
            <li key={step.label} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-1.5">
                <span className="text-[11px] font-semibold text-gray-400">{i + 1}</span>
                <span className="font-medium text-gray-900">{step.label}</span>
                <span className="hidden sm:inline text-xs text-gray-500">{step.detail}</span>
              </span>
              {i < ROADMAP.length - 1 ? <ChevronRight className="w-4 h-4 text-gray-300" /> : null}
            </li>
          ))}
        </ol>
      </div>

      {/* Capability map */}
      <div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Capability map</h2>
            <p className="text-sm text-gray-500">What the Companion should do — and what is live today.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {CAPABILITIES.map((cap) => {
            const meta = STATUS_META[cap.status];
            const StatusIcon = meta.Icon;
            const Icon = cap.icon;
            return (
              <div key={cap.name} className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-navy-900/[0.06]">
                      <Icon className="w-4 h-4 text-navy-900" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">{cap.name}</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{cap.purpose}</p>
                <ul className="mt-3 space-y-1 text-xs text-gray-500 flex-1">
                  {cap.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-gray-300">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cap.href ? (
                    <Link to={cap.href} className="text-xs font-medium text-admin-accent hover:underline">
                      Admin tools →
                    </Link>
                  ) : null}
                  {cap.studentHref ? (
                    <Link to={cap.studentHref} className="text-xs font-medium text-gray-500 hover:underline">
                      Student experience →
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
