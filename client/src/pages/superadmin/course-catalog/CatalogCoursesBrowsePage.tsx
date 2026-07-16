// =============================================================================
// Catalog course browse — All / Featured / Recent / Drafts / Archived
// =============================================================================

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";
import CatalogCourseCard from "../../../components/superadmin/course-catalog/CatalogCourseCard";
import courseCatalogService, {
  COURSE_CATALOG_BASE as BASE,
  PHASE1_CATALOG_DOMAINS,
  type CatalogCourse,
} from "../../../services/courseCatalogService";

function viewFromPath(pathname: string): {
  title: string;
  status?: string;
  sortHint?: "featured" | "recent";
} {
  if (pathname.endsWith("/featured")) return { title: "Featured Courses", status: "published", sortHint: "featured" };
  if (pathname.endsWith("/recent")) return { title: "Recently Published", status: "published", sortHint: "recent" };
  if (pathname.endsWith("/drafts")) return { title: "Draft Courses", status: "draft" };
  if (pathname.endsWith("/archived")) return { title: "Archived Courses", status: "archived" };
  return { title: "All Courses", status: "all" };
}

export default function CatalogCoursesBrowsePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = viewFromPath(location.pathname);

  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    courseCatalogService
      .listCourses({
        status: view.status === "all" ? undefined : view.status,
        search: debounced || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
        limit: 48,
      })
      .then((r) => {
        setCourses(r.courses);
        setTotal(r.total);
      })
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  }, [view.status, debounced, category, difficulty, location.pathname]);

  const publish = async (id: string) => {
    setBusyId(id);
    try {
      await courseCatalogService.publishCourse(id);
      toast.success("Published");
      setCourses((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "published" } : c)).filter((c) =>
          view.status === "draft" ? c.id !== id : true
        )
      );
    } catch {
      toast.error("Publish failed — use Course Builder Review if gates block");
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (id: string) => {
    setBusyId(id);
    try {
      await courseCatalogService.archiveCourse(id);
      toast.success("Archived");
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Archive failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{view.title}</h2>
          <p className="text-sm text-gray-500">{total} courses · natural search across name, category, tags</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Python Beginner, Easy Aptitude…"
              className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
          >
            <option value="">All domains</option>
            {PHASE1_CATALOG_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
          >
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-500">
          No courses match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => (
            <CatalogCourseCard
              key={c.id}
              id={c.id}
              title={c.title}
              category={c.category}
              difficulty={c.difficulty}
              status={c.status}
              durationHours={c.duration_hours}
              modules={c.module_count || c.total_modules}
              practice={c.practice_items}
              coding={c.coding_items}
              assessments={c.assessment_items}
              enrollments={c.enrollments}
              description={c.description}
              instructorName={c.instructor_name}
              onOpen={(id) => navigate(`${BASE}/courses/${id}`)}
              actions={
                <>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:underline"
                    onClick={() => navigate(`${BASE}/courses/${c.id}`)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:underline"
                    onClick={() => navigate(`/app/superadmin/course-builder/${c.id}`)}
                  >
                    Edit in Builder
                  </button>
                  {c.status === "draft" ? (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      className="text-xs text-emerald-700 hover:underline disabled:opacity-40"
                      onClick={() => void publish(c.id)}
                    >
                      Publish
                    </button>
                  ) : null}
                  {c.status !== "archived" ? (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      className="text-xs text-rose-600 hover:underline disabled:opacity-40"
                      onClick={() => void archive(c.id)}
                    >
                      Archive
                    </button>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
