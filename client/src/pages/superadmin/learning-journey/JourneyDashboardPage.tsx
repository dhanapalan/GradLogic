// =============================================================================
// AI Learning Journey Dashboard — KPIs + placement-ready workflow + charts
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Route,
  CheckCircle2,
  Users,
  Percent,
  Target,
  ListTodo,
  ClipboardList,
  Clock,
  Loader2,
  Sprout,
} from "lucide-react";
import toast from "react-hot-toast";
import StatTile from "../../../components/superadmin/learning-companion/StatTile";
import learningJourneyService, {
  LEARNING_JOURNEY_BASE as BASE,
  type JourneyDashboard,
} from "../../../services/learningJourneyService";

/** Student funnel — AI companion personalizes; Catalog/Builder supply content. */
const STUDENT_WORKFLOW = [
  "Login",
  "Choose Goal",
  "Placement Track",
  "AI Skill Assessment",
  "Personalized Journey",
  "Daily Plan",
  "Lesson",
  "Practice",
  "Coding",
  "AI Mentor Feedback",
  "Revision",
  "Mock Test",
  "Readiness Score",
  "Placement Ready",
] as const;

function BarChart({
  items,
  valueKey,
  labelKey,
  emptyHint,
}: {
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  emptyHint: string;
}) {
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
  const hasData = items.some((i) => Number(i[valueKey]) > 0);

  if (!hasData) {
    return <p className="text-xs text-gray-400 py-8 text-center">{emptyHint}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.round((val / max) * 100);
        return (
          <li key={String(item[labelKey])} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-gray-600">{String(item[labelKey])}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-navy-900/80"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-right tabular-nums text-gray-500">{val}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function JourneyDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<JourneyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    learningJourneyService
      .getDashboard()
      .then(setStats)
      .catch((err) => {
        const msg = err?.response?.data?.error || "Failed to load journey dashboard";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await learningJourneyService.seedPhase1();
      toast.success(
        res.created_count > 0
          ? `Seeded ${res.created_count} Phase-1 templates`
          : "Phase-1 templates already present"
      );
      load();
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800">
        {error || "AI Learning Journey dashboard unavailable"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Learning Journey dashboard</h2>
          <p className="text-sm text-gray-500">
            Placement-ready roadmaps for Aptitude, Reasoning, Python, Java, and AI/ML — personalized
            by the AI Learning Companion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={seeding}
            onClick={() => void seed()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            <Sprout className="w-4 h-4" />
            {seeding ? "Seeding…" : "Seed Phase-1 templates"}
          </button>
          <Link
            to={`${BASE}/templates`}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Route className="w-4 h-4" />
            Templates
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900">Student workflow</h3>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          AI generates and adapts the journey; Catalog courses and Knowledge Library assets are
          referenced, never duplicated.
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STUDENT_WORKFLOW.map((step, i) => (
            <div key={step} className="flex items-center gap-1.5 shrink-0">
              <span className="rounded-md bg-slate-50 border border-gray-100 px-2 py-1.5 text-[11px] font-medium text-gray-700 whitespace-nowrap">
                {step}
              </span>
              {i < STUDENT_WORKFLOW.length - 1 ? (
                <span className="text-gray-300 text-xs" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">KPIs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Active Journeys"
            value={stats.activeJourneys}
            icon={Route}
            onClick={() => navigate(`${BASE}/student-journeys`)}
          />
          <StatTile
            label="Completed Journeys"
            value={stats.completedJourneys}
            icon={CheckCircle2}
            accent="green"
            onClick={() => navigate(`${BASE}/student-journeys`)}
          />
          <StatTile
            label="Students In Progress"
            value={stats.studentsInProgress}
            icon={Users}
            accent="blue"
          />
          <StatTile
            label="Avg Completion"
            value={stats.averageCompletion != null ? `${stats.averageCompletion}%` : "—"}
            icon={Percent}
            accent="slate"
            unavailable={stats.averageCompletion == null}
          />
          <StatTile
            label="Avg Placement Readiness"
            value={
              stats.averagePlacementReadiness != null
                ? `${stats.averagePlacementReadiness}`
                : "—"
            }
            icon={Target}
            accent="amber"
            unavailable={stats.averagePlacementReadiness == null}
          />
          <StatTile label="Today's Tasks" value={stats.todaysTasks} icon={ListTodo} accent="navy" />
          <StatTile
            label="Upcoming Mock Tests"
            value={stats.upcomingMockTests}
            icon={ClipboardList}
            accent="purple"
          />
          <StatTile
            label="Pending Reviews"
            value={stats.pendingReviews}
            icon={Clock}
            accent="rose"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Journey Progress</h3>
          <BarChart
            items={stats.charts.journeyProgress}
            valueKey="avg_progress"
            labelKey="label"
            emptyHint="No student journeys yet — assign templates after skill assessment."
          />
        </div>
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Placement Readiness</h3>
          <BarChart
            items={stats.charts.placementReadiness.map((b) => ({
              label: b.bucket,
              count: b.count,
            }))}
            valueKey="count"
            labelKey="label"
            emptyHint="Readiness buckets appear after AI-personalized journeys are active."
          />
        </div>
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Skill Mastery</h3>
          <BarChart
            items={stats.charts.skillMastery}
            valueKey="avg_readiness"
            labelKey="label"
            emptyHint="Skill mastery averages populate from journey readiness scores."
          />
        </div>
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Daily Learning Completion</h3>
          <BarChart
            items={stats.charts.dailyLearningCompletion}
            valueKey="completed"
            labelKey="day"
            emptyHint="Daily completion tracking ships with Daily Learning Plan."
          />
        </div>
      </section>

      <p className="text-xs text-gray-400">
        {stats.templatesPublished} published templates · {stats.phase1Domains} Phase-1 domains ·
        Companion personalizes; Catalog/Builder/Knowledge Library supply the content.
      </p>
    </div>
  );
}
