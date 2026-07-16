// =============================================================================
// Course Builder — All / Draft / Published / Archived list
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";
import CourseCard from "../../../components/superadmin/course-builder/CourseCard";
import courseBuilderService, {
  COURSE_BUILDER_BASE as BASE,
  PHASE1_DOMAINS,
  type Course,
  type CourseStatus,
} from "../../../services/courseBuilderService";

function statusFromPath(pathname: string): CourseStatus | "all" {
  if (pathname.endsWith("/draft")) return "draft";
  if (pathname.endsWith("/published")) return "published";
  if (pathname.endsWith("/archived")) return "archived";
  return "all";
}

const TITLES: Record<string, string> = {
  all: "All Courses",
  draft: "Draft Courses",
  published: "Published Courses",
  archived: "Archived Courses",
};

export default function CourseListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const statusFilter = statusFromPath(location.pathname);
  const categoryParam = searchParams.get("category") || "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    courseBuilderService
      .listCourses({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
        category: categoryParam || undefined,
      })
      .then(setCourses)
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  }, [statusFilter, search, categoryParam]);

  const title = TITLES[statusFilter] || "Courses";

  const domainLabel = useMemo(
    () => PHASE1_DOMAINS.find((d) => d.value === categoryParam)?.label,
    [categoryParam]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">
            {domainLabel
              ? `Filtered by Phase-1 domain: ${domainLabel}`
              : "Open a course to continue assembling Knowledge Library assets."}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-500">
          No courses in this view.{" "}
          <button
            type="button"
            className="text-admin-accent hover:underline"
            onClick={() => navigate(`${BASE}/new`)}
          >
            Create one with the wizard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              id={c.id}
              title={c.title}
              category={c.category}
              difficulty={c.difficulty}
              status={c.status}
              totalModules={c.total_modules}
              enrollments={c.enrollment_count ?? c.total_enrollments ?? 0}
              description={c.description}
              onOpen={(id) => navigate(`${BASE}/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
