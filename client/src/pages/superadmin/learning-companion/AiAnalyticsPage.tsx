// =============================================================================
// AI Analytics Dashboard (Phase 11) — platform-wide content + usage health.
// =============================================================================

import { useEffect, useState } from "react";
import {
  BarChart3, TrendingDown, Copy, ShieldAlert, GraduationCap, Clock, Layers,
  Mic, Sparkles, Lightbulb, Loader2,
} from "lucide-react";
import aiAnalytics, { type AiAnalyticsDashboard } from "../../../services/aiAnalyticsService";

const SEVERITY_COLOR: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

function SectionCard({ icon: Icon, title, children }: { icon: typeof BarChart3; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-navy-900" /> {title}
      </h2>
      {children}
    </div>
  );
}

export default function AiAnalyticsPage() {
  const [data, setData] = useState<AiAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiAnalytics
      .getDashboard()
      .then(setData)
      .catch(() => setError("Couldn't load analytics — try again."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <BarChart3 className="w-5 h-5 text-navy-900" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">AI Analytics Dashboard</h1>
      </div>

      {/* Recommendations */}
      <SectionCard icon={Lightbulb} title="Recommendations">
        <div className="space-y-2">
          {data.recommendations.map((r, i) => (
            <div key={i} className={`text-sm px-3 py-2 rounded-lg border ${SEVERITY_COLOR[r.severity]}`}>
              {r.message}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Knowledge coverage */}
        <SectionCard icon={Layers} title="Knowledge coverage">
          <div className="space-y-2">
            {data.knowledgeCoverage.map((c) => (
              <div key={c.category} className="flex items-center gap-2 text-sm">
                <span className="capitalize text-gray-600 w-32 shrink-0">{c.category.replace(/_/g, " ")}</span>
                <span className="text-xs text-gray-400">{c.totalQuestions} total ({c.easy}E/{c.medium}M/{c.hard}H)</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Weak subjects */}
        <SectionCard icon={TrendingDown} title="Weak subjects (platform-wide)">
          {data.weakSubjects.length === 0 ? (
            <p className="text-sm text-gray-400">Not enough attempt data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.weakSubjects.slice(0, 6).map((s) => (
                <div key={s.category} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{s.category.replace(/_/g, " ")}</span>
                  <span className={`text-xs font-medium ${s.accuracy < 0.5 ? "text-red-600" : "text-gray-500"}`}>
                    {Math.round(s.accuracy * 100)}% ({s.attempts} attempts)
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Duplicate questions */}
        <SectionCard icon={Copy} title="Duplicate questions">
          <p className="text-xs text-gray-400 mb-2">
            Scanned {data.duplicateQuestions.scannedCount} of {data.duplicateQuestions.totalEmbedded} embedded questions.
          </p>
          {data.duplicateQuestions.pairs.length === 0 ? (
            <p className="text-sm text-gray-400">No likely duplicates found.</p>
          ) : (
            <div className="space-y-2">
              {data.duplicateQuestions.pairs.slice(0, 5).map((p, i) => (
                <div key={i} className="text-xs p-2 bg-gray-50 rounded-lg">
                  <span className="font-medium text-amber-600">{Math.round(p.similarity * 100)}% similar</span>
                  <p className="text-gray-600 mt-1 line-clamp-1">{p.a.question_text}</p>
                  <p className="text-gray-600 line-clamp-1">{p.b.question_text}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Question quality */}
        <SectionCard icon={ShieldAlert} title="Question quality flags">
          {data.questionQuality.length === 0 ? (
            <p className="text-sm text-gray-400">No quality issues flagged.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.questionQuality.map((q) => (
                <div key={q.id} className="text-xs p-2 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 line-clamp-1">{q.question_text}</p>
                  <p className="text-amber-600 mt-0.5">{q.reasons.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Student success */}
        <SectionCard icon={GraduationCap} title="Student success">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.studentSuccess.examsTaken}</p>
              <p className="text-xs text-gray-400">exams taken</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data.studentSuccess.averageExamScore !== null ? Math.round(data.studentSuccess.averageExamScore) : "—"}
              </p>
              <p className="text-xs text-gray-400">avg score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.studentSuccess.studentsWithScores}</p>
              <p className="text-xs text-gray-400">students scored</p>
            </div>
          </div>
        </SectionCard>

        {/* Learning time */}
        <SectionCard icon={Clock} title="Learning time">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.learningTime.totalPracticeMinutes}</p>
              <p className="text-xs text-gray-400">total minutes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.learningTime.totalSessions}</p>
              <p className="text-xs text-gray-400">sessions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.learningTime.averageSessionMinutes}</p>
              <p className="text-xs text-gray-400">avg min/session</p>
            </div>
          </div>
        </SectionCard>

        {/* Skill coverage */}
        <SectionCard icon={Layers} title="Skill coverage (questions vs lessons)">
          <div className="space-y-2">
            {data.skillCoverage.map((s) => (
              <div key={s.category} className="flex items-center justify-between text-sm">
                <span className="capitalize text-gray-600">{s.category.replace(/_/g, " ")}</span>
                <span className="text-xs text-gray-400">
                  {s.questionCount} questions · {s.lessonCount} lessons{" "}
                  {s.lessonCount === 0 && <span className="text-amber-600">(gap)</span>}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* AI / Voice usage */}
        <SectionCard icon={Sparkles} title="AI usage (last 30 days)">
          <p className="text-sm text-gray-700 mb-3">
            <span className="text-2xl font-bold">{data.aiUsage.total}</span> total calls ·{" "}
            <span className="inline-flex items-center gap-1 text-indigo-600"><Mic className="w-3.5 h-3.5" /> {data.aiUsage.voiceEvents} voice</span>
          </p>
          {data.aiUsage.byFeature.length === 0 ? (
            <p className="text-sm text-gray-400">No AI usage recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.aiUsage.byFeature.map((f) => (
                <div key={f.feature} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{f.feature}</span>
                  <span className="text-gray-400">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
