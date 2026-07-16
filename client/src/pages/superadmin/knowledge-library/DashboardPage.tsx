// =============================================================================
// Knowledge Library Dashboard (Sprint 1) — widgets first, not a list
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ListChecks,
  Code2,
  FileStack,
  Mic,
  Video,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  FileEdit,
  Loader2,
  MessageSquare,
  Boxes,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatTile from "../../../components/superadmin/learning-companion/StatTile";
import {
  getKnowledgeLibraryStats,
  type KnowledgeLibraryStats,
} from "../../../services/knowledgeLibraryService";

const BASE = "/app/superadmin/knowledge-library";
const PIE_COLORS = ["#0f172a", "#64748b"];

export default function KnowledgeLibraryDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KnowledgeLibraryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKnowledgeLibraryStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  const assets = [
    { label: "Lessons", value: stats.lessons, icon: BookOpen, accent: "navy" as const, href: `${BASE}/assets/lessons` },
    { label: "Questions", value: stats.questions, icon: ListChecks, accent: "blue" as const, href: `${BASE}/assets/questions` },
    {
      label: "Coding Challenges",
      value: stats.codingChallenges,
      icon: Code2,
      accent: "purple" as const,
      href: `${BASE}/assets/coding`,
    },
    { label: "Flashcards", value: stats.flashcards, icon: FileStack, accent: "amber" as const, href: `${BASE}/assets/flashcards` },
    { label: "Voice Lessons", value: stats.voiceLessons, icon: Mic, accent: "green" as const, href: `${BASE}/assets/voice-lessons` },
    { label: "Videos", value: stats.videos, icon: Video, accent: "slate" as const, href: `${BASE}/assets/videos` },
    { label: "Documents", value: stats.documents, icon: FileText, accent: "slate" as const, href: `${BASE}/assets/documents` },
    {
      label: "Interview Questions",
      value: stats.interviews,
      icon: MessageSquare,
      accent: "blue" as const,
      href: `${BASE}/assets/interview-questions`,
    },
    {
      label: "Case Studies",
      value: stats.caseStudies,
      icon: Boxes,
      accent: "amber" as const,
      href: `${BASE}/assets/case-studies`,
    },
  ];

  const lifecycle = [
    {
      label: "Pending Review",
      value: stats.pendingReview,
      icon: ClipboardCheck,
      accent: "amber" as const,
      href: "/app/superadmin/learning-companion/review",
    },
    {
      label: "Published",
      value: stats.published,
      icon: CheckCircle2,
      accent: "green" as const,
      href: `${BASE}/assets/questions?status=published`,
    },
    {
      label: "Draft",
      value: stats.draft,
      icon: FileEdit,
      accent: "slate" as const,
      href: `${BASE}/assets/questions?status=draft`,
    },
  ];

  const sourceData = [
    { name: "AI generated", value: stats.bySource.ai },
    { name: "Manual", value: stats.bySource.manual },
  ];

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Knowledge assets</h2>
            <p className="text-xs text-gray-500">Live counts from the current repository</p>
          </div>
          <Link to={`${BASE}/create`} className="text-sm font-medium text-admin-accent hover:underline">
            Create Knowledge Asset →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {assets.map((a) => (
            <StatTile
              key={a.label}
              label={a.label}
              value={a.value}
              icon={a.icon}
              accent={a.accent}
              unavailable={"unavailable" in a && a.unavailable}
              onClick={a.href ? () => navigate(a.href!) : undefined}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Lifecycle</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {lifecycle.map((a) => (
            <StatTile
              key={a.label}
              label={a.label}
              value={a.value}
              icon={a.icon}
              accent={a.accent}
              onClick={() => navigate(a.href)}
            />
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Subject distribution</h3>
          <p className="text-xs text-gray-500 mb-4">Questions by subject (category enum today)</p>
          {stats.byCategory.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No subject data yet</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byCategory} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">AI vs manual</h3>
          <p className="text-xs text-gray-500 mb-4">Question provenance (ai-generated tag)</p>
          <div className="h-56 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="shrink-0 space-y-2 text-sm pr-2">
              {sourceData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-medium text-gray-900">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-admin-card">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Topics</h3>
            <p className="text-xs text-gray-500">
              Formal Category → Subject → Topic tree. Open Organization to manage and link assets.
            </p>
          </div>
          <Link to={`${BASE}/organization`} className="text-xs font-medium text-admin-accent hover:underline">
            Organization →
          </Link>
        </div>
        {stats.topTopics.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No topic tags yet — create topics under Organization</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.topTopics.map((t) => (
              <Link
                key={t.name}
                to={`${BASE}/all?tag=${encodeURIComponent(t.name)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-1.5 text-sm hover:border-gray-300"
              >
                <span className="font-medium text-gray-900">{t.name}</span>
                <span className="text-xs text-gray-400">{t.count}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-navy-900/10 bg-navy-900 text-white p-5">
        <h3 className="text-sm font-semibold">AI Features</h3>
        <p className="text-sm text-white/70 mt-1">
          Semantic search, metadata, translation, embeddings, duplicates, and related knowledge.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={`${BASE}/ai`}
            className="inline-flex rounded-lg bg-white px-3 py-2 text-sm font-medium text-navy-900"
          >
            Open AI Hub →
          </Link>
          <Link
            to={`${BASE}/enterprise`}
            className="inline-flex rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Enterprise →
          </Link>
        </div>
      </section>
    </div>
  );
}
