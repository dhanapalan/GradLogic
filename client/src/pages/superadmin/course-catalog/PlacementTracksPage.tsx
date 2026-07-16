// =============================================================================
// Placement Tracks — catalog centerpiece (Phase-1)
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Layers } from "lucide-react";
import toast from "react-hot-toast";
import CatalogCourseCard from "../../../components/superadmin/course-catalog/CatalogCourseCard";
import courseCatalogService, {
  COURSE_CATALOG_BASE as BASE,
  type PlacementTrackSummary,
} from "../../../services/courseCatalogService";

export function PlacementTracksPage() {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<PlacementTrackSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    courseCatalogService
      .listTracks()
      .then(setTracks)
      .catch(() => toast.error("Failed to load tracks"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Placement Tracks</h2>
        <p className="text-sm text-gray-500 mt-1">
          Coherent paths toward placement readiness — not a flat course list. Each track bundles
          Phase-1 domain courses assembled in Course Builder.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tracks.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => navigate(`${BASE}/tracks/${t.slug}`)}
            className="text-left rounded-2xl border border-gray-200/70 bg-white p-6 shadow-admin-card hover:border-navy-900/40 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {t.domain_label}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-gray-900">{t.title}</h3>
              </div>
              <span className="rounded-lg bg-navy-900/[0.06] p-2 text-navy-900">
                <Layers className="w-5 h-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-600">{t.description}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>{t.published_courses} published courses</span>
              <span>{t.draft_courses} drafts</span>
              <span>{t.total_modules} modules</span>
              <span>{t.enrollments} enrollments</span>
              <span>~{t.estimated_weeks} weeks</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlacementTrackDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Awaited<ReturnType<typeof courseCatalogService.getTrack>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    courseCatalogService
      .getTrack(slug)
      .then(setTrack)
      .catch(() => toast.error("Track not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading || !track) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`${BASE}/tracks`}
          className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All tracks
        </Link>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-gray-400">{track.domain_label}</p>
        <h2 className="text-2xl font-semibold text-gray-900">{track.title}</h2>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">{track.description}</p>
        <p className="mt-2 text-xs text-gray-400">
          ~{track.estimated_weeks} weeks · Practice packs & mock tests come from mapped Knowledge
          Library assessments on each course.
        </p>
      </div>

      {(track.courses || []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No courses in this track yet.{" "}
          <Link to="/app/superadmin/course-builder/templates" className="text-admin-accent hover:underline">
            Create from a Phase-1 template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {track.courses.map(
            (c: {
              id: string;
              title: string;
              category: string;
              difficulty: string;
              status: string;
              duration_hours: number | null;
              total_modules: number;
              enrollments: number;
              description: string | null;
              instructor_name: string | null;
              mapped_assets: number;
            }) => (
              <CatalogCourseCard
                key={c.id}
                id={c.id}
                title={c.title}
                category={c.category}
                difficulty={c.difficulty}
                status={c.status}
                durationHours={c.duration_hours}
                modules={c.total_modules}
                practice={c.mapped_assets}
                enrollments={c.enrollments}
                description={c.description}
                instructorName={c.instructor_name}
                onOpen={(id) => navigate(`${BASE}/courses/${id}`)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
