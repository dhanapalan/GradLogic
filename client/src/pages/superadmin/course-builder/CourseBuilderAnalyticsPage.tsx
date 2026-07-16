// =============================================================================
// Course Builder Analytics — assembly health + enrollment widgets (Inc 5)
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  Link2,
  Layers,
  Sparkles,
  LayoutTemplate,
  Users,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import StatTile from "../../../components/superadmin/learning-companion/StatTile";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  PHASE1_DOMAINS,
  type CourseBuilderAnalytics,
} from "../../../services/courseBuilderService";

export default function CourseBuilderAnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CourseBuilderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    courseBuilderService
      .getAnalytics()
      .then(setData)
      .catch((err) => {
        const msg = err?.response?.data?.error || "Failed to load analytics";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800">
        {error || "Analytics unavailable"}
      </div>
    );
  }

  const d = data.dashboard;
  const domainLabel = (v: string) =>
    PHASE1_DOMAINS.find((x) => x.value === v)?.label || v.replace(/_/g, " ");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Course Builder analytics</h2>
        <p className="text-sm text-gray-500">
          Assembly health for placed-prep courses. Metrics are live — never invented.
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Lifecycle</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Total"
            value={d.total}
            icon={Layers}
            onClick={() => navigate(`${BASE}/all`)}
          />
          <StatTile
            label="Published"
            value={d.published}
            icon={CheckCircle2}
            accent="green"
            onClick={() => navigate(`${BASE}/published`)}
          />
          <StatTile
            label="Draft"
            value={d.draft}
            icon={AlertTriangle}
            accent="amber"
            onClick={() => navigate(`${BASE}/draft`)}
          />
          <StatTile label="Enrolled" value={d.studentsEnrolled} icon={Users} accent="blue" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Assembly</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="KL asset mappings" value={data.assetMappings} icon={Link2} accent="navy" />
          <StatTile
            label="Avg modules / course"
            value={data.avgModulesPerCourse != null ? data.avgModulesPerCourse : "—"}
            icon={Layers}
            accent="slate"
            unavailable={data.avgModulesPerCourse == null}
          />
          <StatTile
            label="AI outline courses"
            value={data.aiOutlineCourses}
            icon={Sparkles}
            accent="purple"
            onClick={() => navigate(`${BASE}/ai`)}
          />
          <StatTile
            label="From templates"
            value={data.templateCourses}
            icon={LayoutTemplate}
            accent="blue"
            onClick={() => navigate(`${BASE}/templates`)}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Publish readiness (recent drafts)</h3>
        <p className="text-xs text-gray-500 mb-3">
          Validated up to 20 newest drafts against practice/assessment gates.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatTile
            label="Ready to publish"
            value={data.draftReadyEstimate}
            icon={CheckCircle2}
            accent="green"
            onClick={() => navigate(`${BASE}/review`)}
          />
          <StatTile
            label="Blocked"
            value={data.draftBlockedEstimate}
            icon={AlertTriangle}
            accent="amber"
            onClick={() => navigate(`${BASE}/review`)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-800">Enrollments by Phase-1 domain</h3>
          {data.enrollmentsByDomain.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">No enrollments yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.enrollmentsByDomain.map((row) => (
                <li key={row.domain} className="flex justify-between text-sm">
                  <span className="text-gray-700">{domainLabel(row.domain)}</span>
                  <span className="font-medium text-gray-900">{row.enrollments}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <h3 className="text-sm font-semibold text-gray-800">Top courses</h3>
          {data.topCourses.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">No courses yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.topCourses.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`${BASE}/${c.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm hover:underline"
                  >
                    <span className="font-medium text-gray-900">{c.title}</span>
                    <span className="text-xs text-gray-400">
                      {c.enrollments} enrolled · {c.modules} mod · {c.assets} assets · {c.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {d.completionPercent != null ? (
        <p className="text-xs text-gray-500">
          Enrollment completion share: <strong>{d.completionPercent}%</strong>
        </p>
      ) : (
        <p className="text-xs text-gray-400">Average rating / rich completion charts — unavailable.</p>
      )}
    </div>
  );
}
