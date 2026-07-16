// =============================================================================
// Course Builder Dashboard — status cards + Phase-1 domains
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  FileEdit,
  CheckCircle2,
  Archive,
  Users,
  Percent,
  Star,
  Loader2,
  Plus,
  Wand2,
} from "lucide-react";
import toast from "react-hot-toast";
import StatTile from "../../../components/superadmin/learning-companion/StatTile";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  PHASE1_DOMAINS,
  type CourseBuilderDashboard,
} from "../../../services/courseBuilderService";

export default function CourseBuilderDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CourseBuilderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    courseBuilderService
      .getDashboard()
      .then(setStats)
      .catch((err) => {
        const msg = err?.response?.data?.error || err?.message || "Failed to load dashboard";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800">
        {error || "Dashboard unavailable"}
      </div>
    );
  }

  const domainCount = (value: string) =>
    stats.byDomain.find((d) => d.domain === value)?.count ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Course dashboard</h2>
          <p className="text-sm text-gray-500">
            Live counts from the LMS course tree. Catalog remains for browse/assign.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${BASE}/templates`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            Templates
          </Link>
          <Link
            to={`${BASE}/analytics`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            Analytics
          </Link>
          <Link to={`${BASE}/ai`} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30">
            <Wand2 className="w-4 h-4" />
            AI Course Builder
          </Link>
          <Link
            to={`${BASE}/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            <Plus className="w-4 h-4" />
            New Course
          </Link>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Lifecycle</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatTile
            label="Total Courses"
            value={stats.total}
            icon={BookOpenCheck}
            accent="navy"
            onClick={() => navigate(`${BASE}/all`)}
          />
          <StatTile
            label="Draft"
            value={stats.draft}
            icon={FileEdit}
            accent="amber"
            onClick={() => navigate(`${BASE}/draft`)}
          />
          <StatTile
            label="Published"
            value={stats.published}
            icon={CheckCircle2}
            accent="green"
            onClick={() => navigate(`${BASE}/published`)}
          />
          <StatTile
            label="Archived"
            value={stats.archived}
            icon={Archive}
            accent="rose"
            onClick={() => navigate(`${BASE}/archived`)}
          />
          <StatTile
            label="Students Enrolled"
            value={stats.studentsEnrolled}
            icon={Users}
            accent="blue"
          />
          <StatTile
            label="Completion %"
            value={stats.completionPercent != null ? `${stats.completionPercent}%` : "—"}
            icon={Percent}
            accent="slate"
            unavailable={stats.completionPercent == null}
          />
          <StatTile
            label="Average Rating"
            value="—"
            icon={Star}
            accent="slate"
            unavailable
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Phase-1 domains</h3>
        <p className="text-xs text-gray-500 mb-3">
          Placement preparation focus: Aptitude, Logical Reasoning, Python, Java, AI/ML.
        </p>
        <div className="flex flex-wrap gap-2">
          {PHASE1_DOMAINS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => navigate(`${BASE}/all?category=${d.value}`)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:border-navy-900/40"
            >
              <span className="font-medium text-gray-800">{d.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-gray-500">
                {domainCount(d.value)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-5 text-sm text-gray-600">
        <p className="font-medium text-gray-800">How Course Builder works</p>
        <p className="mt-1">
          Knowledge Library holds lessons, questions, coding challenges, and voice — Course Builder
          only assembles them into modules for the student learning journey.
        </p>
        <Link to={`${BASE}/new`} className="mt-3 inline-block text-admin-accent hover:underline">
          Start the New Course wizard →
        </Link>
      </section>
    </div>
  );
}
