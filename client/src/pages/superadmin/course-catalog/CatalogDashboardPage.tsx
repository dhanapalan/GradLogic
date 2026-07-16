// =============================================================================
// Course Catalog Dashboard — KPIs + Placement Tracks teaser + featured
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  CheckCircle2,
  FileEdit,
  Archive,
  Route,
  Users,
  Percent,
  Star,
  Loader2,
  Eye,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import StatTile from "../../../components/superadmin/learning-companion/StatTile";
import CatalogCourseCard from "../../../components/superadmin/course-catalog/CatalogCourseCard";
import courseCatalogService, {
  COURSE_CATALOG_BASE as BASE,
  type CatalogDashboard,
  type PlacementTrackSummary,
} from "../../../services/courseCatalogService";

export default function CatalogDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CatalogDashboard | null>(null);
  const [tracks, setTracks] = useState<PlacementTrackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([courseCatalogService.getDashboard(), courseCatalogService.listTracks()])
      .then(([d, t]) => {
        setStats(d);
        setTracks(t);
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || "Failed to load catalog";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

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
        {error || "Catalog unavailable"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Catalog dashboard</h2>
          <p className="text-sm text-gray-500">
            Publish and discover placement-ready courses. Tracks organize the student journey.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${BASE}/tracks`}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Route className="w-4 h-4" />
            Placement Tracks
          </Link>
          <Link
            to={`${BASE}/drafts`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <Send className="w-4 h-4" />
            Review drafts
          </Link>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">KPIs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Total Courses" value={stats.total} icon={BookOpenCheck} onClick={() => navigate(`${BASE}/all`)} />
          <StatTile label="Published" value={stats.published} icon={CheckCircle2} accent="green" onClick={() => navigate(`${BASE}/featured`)} />
          <StatTile label="Draft" value={stats.draft} icon={FileEdit} accent="amber" onClick={() => navigate(`${BASE}/drafts`)} />
          <StatTile label="Archived" value={stats.archived} icon={Archive} accent="rose" onClick={() => navigate(`${BASE}/archived`)} />
          <StatTile label="Placement Tracks" value={stats.placementTracks} icon={Route} accent="blue" onClick={() => navigate(`${BASE}/tracks`)} />
          <StatTile label="Students Enrolled" value={stats.studentsEnrolled} icon={Users} accent="navy" />
          <StatTile
            label="Avg Completion"
            value={stats.averageCompletion != null ? `${stats.averageCompletion}%` : "—"}
            icon={Percent}
            accent="slate"
            unavailable={stats.averageCompletion == null}
          />
          <StatTile label="Avg Rating" value="—" icon={Star} accent="slate" unavailable />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Placement Tracks</h3>
          <Link to={`${BASE}/tracks`} className="text-xs text-admin-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tracks.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => navigate(`${BASE}/tracks/${t.slug}`)}
              className="text-left rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card hover:border-navy-900/40"
            >
              <p className="text-[11px] uppercase tracking-wider text-gray-400">{t.domain_label}</p>
              <p className="mt-1 font-semibold text-gray-900">{t.title}</p>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{t.description}</p>
              <p className="mt-3 text-[11px] text-gray-400">
                {t.published_courses} published · {t.enrollments} enrolled · ~{t.estimated_weeks} wks
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Featured published</h3>
          <Link to={`${BASE}/featured`} className="text-xs text-admin-accent hover:underline">
            More →
          </Link>
        </div>
        {stats.featured.length === 0 ? (
          <p className="text-sm text-gray-400">No published courses yet — publish from Course Builder Review.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.featured.map((c) => (
              <CatalogCourseCard
                key={c.id}
                id={c.id}
                title={c.title}
                category={c.category}
                difficulty={c.difficulty}
                status={c.status}
                modules={c.total_modules}
                enrollments={c.enrollments}
                onOpen={(id) => navigate(`${BASE}/courses/${id}`)}
                actions={
                  <button
                    type="button"
                    className="text-xs text-admin-accent inline-flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`${BASE}/courses/${c.id}`);
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
