// =============================================================================
// Assessment Hub · Question Bank — master repository hub (not a second store)
// Same `question_bank` table as Knowledge Library; this surface is assessment-facing.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Library,
  Sparkles,
  Upload,
  GitBranch,
  Tags,
  ListChecks,
  Mic,
  Lightbulb,
  FileQuestion,
  Shuffle,
  Gauge,
  BookOpen,
  Loader2,
  ArrowRight,
  Layers,
} from "lucide-react";
import questionBankService from "../../../services/questionBankService";
import {
  PHASE1_PLACEMENT_DOMAINS,
  PHASE1_PLACEMENT_TRACK,
} from "../../../lib/phase1PlacementDomains";

const BASE = "/app/superadmin/question-bank";

/** Placement Preparation Phase 1 only (maps to question_bank.category). */
const DOMAINS = PHASE1_PLACEMENT_DOMAINS.map((d) => ({
  key: d.value,
  label: d.label,
  category: d.bankCategory,
}));

/** Phase-1 question shapes — avoid engineering-specific item types. */
const QUESTION_TYPES = [
  { label: "Multiple Choice", bank: true, note: "Stored as multiple_choice" },
  { label: "Single Choice", bank: true, note: "MCQ with one correct option" },
  { label: "True / False", bank: false, note: "AI generate → import as MCQ" },
  { label: "Fill in Blank", bank: false, note: "AI generate / short answer pipeline" },
  { label: "Coding", bank: true, note: "Python / Java coding_challenge" },
] as const;

const FEATURES: Array<{
  title: string;
  description: string;
  href: string;
  icon: typeof Sparkles;
  accent: string;
}> = [
  {
    title: "Browse & manage",
    description: "Search, edit, export, and CSV bulk-manage the master question repository.",
    href: `${BASE}/browse`,
    icon: Library,
    accent: "bg-navy-900/[0.06] text-navy-900",
  },
  {
    title: "AI Question Generation",
    description: "Generate aptitude, reasoning, coding, and AI/ML items into the bank.",
    href: `${BASE}/ai-generator`,
    icon: Sparkles,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    title: "AI Difficulty Classification",
    description: "Classify difficulty and Bloom metadata for bank items.",
    href: "/app/superadmin/knowledge-library/ai/metadata",
    icon: Gauge,
    accent: "bg-blue-50 text-blue-700",
  },
  {
    title: "AI Similar Question Detection",
    description: "Find near-duplicates and related items before publish.",
    href: "/app/superadmin/knowledge-library/ai/duplicates",
    icon: Shuffle,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    title: "AI Explanation & Hint",
    description: "Improve explanations and hints; keep version history per question.",
    href: "/app/superadmin/ai-studio/content-improver",
    icon: Lightbulb,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Voice Explanation",
    description: "Tutor voice explain/hint flows and voice lessons for spoken guidance.",
    href: "/app/superadmin/voice-studio/tutor-voices",
    icon: Mic,
    accent: "bg-rose-50 text-rose-700",
  },
  {
    title: "Bulk Import",
    description: "CSV on browse, PDF import, and book import into the same repository.",
    href: `${BASE}/import-books`,
    icon: Upload,
    accent: "bg-slate-100 text-slate-700",
  },
  {
    title: "Version History",
    description: "Question versions from AI improve / enterprise version tooling.",
    href: "/app/superadmin/knowledge-library/enterprise/versions",
    icon: GitBranch,
    accent: "bg-indigo-50 text-indigo-700",
  },
  {
    title: "Categories & subjects",
    description: "Organize bank categories for Aptitude, Reasoning, Programming, AI/ML.",
    href: `${BASE}/categories`,
    icon: Tags,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    title: "Review queue",
    description: "Approve AI-generated and imported items before they power assessments.",
    href: `${BASE}/review-queue`,
    icon: ListChecks,
    accent: "bg-orange-50 text-orange-700",
  },
  {
    title: "Question Collections",
    description: "Next step in the Assessment pipeline — group questions for the Builder.",
    href: "/app/superadmin/question-collections",
    icon: Layers,
    accent: "bg-teal-50 text-teal-800",
  },
];

export default function QuestionBankHubPage() {
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    questionBankService
      .searchQuestions({ limit: 1 })
      .then((r) => setTotal(r.total ?? 0))
      .catch(() => setTotal(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · {PHASE1_PLACEMENT_TRACK.title} (Phase 1)
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <FileQuestion className="w-6 h-6 text-navy-900" />
                Question Bank
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                {PHASE1_PLACEMENT_TRACK.description} Same `question_bank` as Knowledge Library —
                no Civil / Mech / ECE or other engineering subjects in Phase 1.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`${BASE}/browse`}
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Browse questions
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={`${BASE}/ai-generator`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                <Sparkles className="w-4 h-4" />
                AI Generate
              </Link>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading count…
              </span>
            ) : total != null ? (
              <>
                <strong className="text-gray-900">{total.toLocaleString()}</strong> questions in the
                master bank
              </>
            ) : (
              "Question count unavailable"
            )}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Placement Preparation · Phase 1
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Aptitude · Logical Reasoning · Python · Java · AI Fundamentals only.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {DOMAINS.map((d) => (
              <Link
                key={d.key}
                to={`${BASE}/browse?category=${d.category}`}
                className="rounded-xl border border-gray-200/70 bg-white px-3 py-3 text-center shadow-admin-card hover:border-navy-900/30 transition-colors"
              >
                <BookOpen className="w-4 h-4 text-navy-900 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-gray-800">{d.label}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Question types</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {QUESTION_TYPES.map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-gray-200/70 bg-white px-3 py-3 shadow-admin-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{t.label}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      t.bank ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {t.bank ? "In bank" : "Via AI"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{t.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.title}
                  to={f.href}
                  className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card hover:border-navy-900/30 hover:shadow-md transition-all group"
                >
                  <div className={`inline-flex rounded-lg p-2.5 ${f.accent}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-gray-900 group-hover:text-navy-900">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">{f.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-gray-400">
          Pipeline: Knowledge Library → <strong className="font-medium text-gray-500">Question Bank</strong>{" "}
          → Question Collections → Assessment Builder → Attempts → Results → AI Learning Journey.
        </p>
      </div>
    </div>
  );
}
