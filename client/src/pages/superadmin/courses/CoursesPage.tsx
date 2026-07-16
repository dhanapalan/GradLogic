// =============================================================================
// Courses (superadmin) — list/create courses, reusing the existing LMS
// backend (server/src/routes/lms.routes.ts). First superadmin-side UI for it.
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpenCheck, Plus } from "lucide-react";
import toast from "react-hot-toast";
import lmsCourseService, { Course } from "../../../services/lmsCourseService";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-50 text-green-700",
  archived: "bg-red-50 text-red-600",
};

export default function CoursesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(searchParams.get("action") === "new");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "", difficulty: "beginner" });

  useEffect(() => {
    if (searchParams.get("action") === "new") setShowCreate(true);
  }, [searchParams]);

  const load = () => {
    setLoading(true);
    lmsCourseService
      .listCourses(statusFilter === "all" ? undefined : { status: statusFilter })
      .then(setCourses)
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.category.trim()) {
      toast.error("Title and category are required");
      return;
    }
    setCreating(true);
    try {
      const course = await lmsCourseService.createCourse(form);
      toast.success("Course created as draft");
      setShowCreate(false);
      setForm({ title: "", description: "", category: "", difficulty: "beginner" });
      navigate(`/app/superadmin/courses/${course.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create course");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-navy-900/[0.06] rounded-lg">
            <BookOpenCheck className="w-5 h-5 text-navy-900" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Course Catalog</h1>
            <p className="text-sm text-gray-500">Browse, create, and publish learning courses.</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
        >
          <Plus className="w-4 h-4" /> New Course
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Course</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            />
            <input
              placeholder="Category * (e.g. aptitude, technical)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            />
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg col-span-2"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Course"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {["all", "draft", "published", "archived"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              statusFilter === s ? "bg-navy-900 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No courses yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/app/superadmin/courses/${c.id}`)}
                className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.category} · {c.difficulty} · {c.total_modules} modules
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-gray-500">
                  <p>{c.total_enrollments} enrolled</p>
                  <p>{c.instructor_name || "—"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
