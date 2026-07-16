// =============================================================================
// Knowledge Library — AI Hub (Sprint 4)
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Search,
  Tags,
  Languages,
  Mic,
  Binary,
  Copy,
  Network,
  Wand2,
  BarChart3,
  Loader2,
} from "lucide-react";
import aiAnalyticsService from "../../../../services/aiAnalyticsService";
import knowledgeLibraryAiService from "../../../../services/knowledgeLibraryAiService";

const BASE = "/app/superadmin/knowledge-library/ai";

const TOOLS = [
  {
    name: "AI Search",
    desc: "Semantic + lexical search across the knowledge repository.",
    href: `${BASE}/search`,
    icon: Search,
  },
  {
    name: "AI Metadata",
    desc: "Summary, Bloom level, difficulty, and skill extraction.",
    href: `${BASE}/metadata`,
    icon: Tags,
  },
  {
    name: "AI Translation",
    desc: "Translate knowledge objects for multi-language learning.",
    href: `${BASE}/translate`,
    icon: Languages,
  },
  {
    name: "AI Voice",
    desc: "Voice Tutor voices and lesson synthesis entry points.",
    href: `${BASE}/voice`,
    icon: Mic,
  },
  {
    name: "Embeddings",
    desc: "Coverage, backfill, and duplicate health.",
    href: `${BASE}/embeddings`,
    icon: Binary,
  },
  {
    name: "Duplicate Detection",
    desc: "Scan a question for near-duplicates by embedding similarity.",
    href: `${BASE}/duplicates`,
    icon: Copy,
  },
  {
    name: "Related Knowledge",
    desc: "Topic siblings and semantic neighbors for one asset.",
    href: `${BASE}/related`,
    icon: Network,
  },
  {
    name: "Improve Content",
    desc: "Grammar, distractors, explanation, and coding versions.",
    href: "/app/superadmin/ai-studio/content-improver",
    icon: Wand2,
  },
  {
    name: "AI Analytics",
    desc: "Usage and quality dashboard for AI features.",
    href: "/app/superadmin/learning-companion/analytics",
    icon: BarChart3,
  },
];

export default function AiHubPage() {
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState<{ total: number; with_embedding: number } | null>(null);
  const [dupes, setDupes] = useState(0);
  const [usage, setUsage] = useState(0);

  useEffect(() => {
    Promise.all([
      knowledgeLibraryAiService.embeddingCoverage().catch(() => null),
      aiAnalyticsService.getDashboard().catch(() => null),
    ]).then(([cov, dash]) => {
      setCoverage(cov);
      setDupes(dash?.duplicateQuestions?.pairs?.length || 0);
      setUsage(dash?.aiUsage?.total || 0);
    }).finally(() => setLoading(false));
  }, []);

  const embedPct =
    coverage && coverage.total > 0
      ? Math.round((coverage.with_embedding / coverage.total) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> AI Features
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Search, metadata, translation, voice, embeddings, duplicates, and related knowledge — composed on top of
          the Knowledge Library.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <Stat label="Embedding coverage" value={embedPct !== null ? `${embedPct}%` : "—"} hint={coverage ? `${coverage.with_embedding}/${coverage.total}` : undefined} />
          <Stat label="Duplicate pairs" value={String(dupes)} hint="From analytics scan" />
          <Stat label="AI usage events" value={String(usage)} hint="Logged features" />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              to={tool.href}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-navy-900/[0.06]">
                  <Icon className="w-4 h-4 text-navy-900" />
                </div>
                <h3 className="font-medium text-gray-900 text-sm">{tool.name}</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{tool.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {hint ? <p className="text-xs text-gray-400 mt-1">{hint}</p> : null}
    </div>
  );
}
